const express = require('express');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const https = require('https');
const http = require('http');
require('dotenv').config();

// â”€â”€ In-memory job store â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const jobs = new Map();   // jobId â†’ { status, createdAt, updatedAt, result, error }
const sseClients = new Map(); // jobId â†’ Set<res>

const SCRIPTS_DIR = path.join(__dirname, 'scripts');

// Configuration from environment variables
const PORT = process.env.PORT || 3000;
const PYTHON_CMD = process.env.PYTHON_CMD || (process.platform === 'win32' ? 'python' : 'python3');
const SHEET_NAMES = {
  evars: process.env.SHEET_NAME_EVARS || 'eVars',
  props: process.env.SHEET_NAME_PROPS || 'props',
  events: process.env.SHEET_NAME_EVENTS || 'custom events (metrics)'
};

// n8n Webhook URLs (3-stage split)
const N8N_BASE_URLS = {
  sdr:  process.env.N8N_SDR_WEBHOOK_URL  || process.env.N8N_WEBHOOK_URL,
  tsd:  process.env.N8N_TSD_WEBHOOK_URL,
  tags: process.env.N8N_TAGS_WEBHOOK_URL,
};

// SDR 완료 후 TSD 자동 트리거 여부 (AUTO_CHAIN_TSD=true 시 활성화)
const AUTO_CHAIN_TSD = (process.env.AUTO_CHAIN_TSD || 'false').toLowerCase() === 'true';

// n8n API Key — execution 강제 중단에 사용 (없으면 n8n 중단 스킵)
const N8N_API_KEY = process.env.N8N_API_KEY || '';

// ── n8n API Base URL ──────────────────────────────────────────────────────────
// Docker 환경에서 webhook-service가 컨테이너 안에서 실행될 경우,
// n8n 웹훅 URL의 'localhost'는 컨테이너 자신을 가리키므로 Stop API 호출이 실패함.
// .env에 N8N_API_BASE_URL=http://host.docker.internal:5678 을 명시하면
// 컨테이너→호스트→n8n 경로로 올바르게 연결됨 (BUG 1 fix).
// 미설정 시 webhook URL에서 origin을 추출해 fallback으로 사용.
function resolveN8nApiBase() {
    if (process.env.N8N_API_BASE_URL) return process.env.N8N_API_BASE_URL.replace(/\/$/, '');
    const anyUrl = Object.values(N8N_BASE_URLS).find(u => u);
    if (!anyUrl) return null;
    try {
        const u = new URL(anyUrl);
        return `${u.protocol}//${u.hostname}:${u.port || (u.protocol === 'https:' ? 443 : 80)}`;
    } catch (_) { return null; }
}

// ── n8n 세션 쿠키 캐시 ────────────────────────────────────────────────────────
// n8n v1.x: /rest/ 엔드포인트는 X-N8N-API-KEY를 거부 → 이메일/비밀번호 로그인 후
// 발급된 세션 쿠키로 인증해야 함. 8시간 캐시로 반복 로그인 방지.
let _n8nSessionCache = { cookie: null, expiry: 0 };

async function getN8nSessionCookie(apiBase) {
    if (_n8nSessionCache.cookie && Date.now() < _n8nSessionCache.expiry) {
        return _n8nSessionCache.cookie;
    }
    const email = process.env.N8N_EMAIL || '';
    const password = process.env.N8N_PASSWORD || '';
    if (!email || !password) return null;

    const urlObj = new URL(apiBase);
    const isHttps = urlObj.protocol === 'https:';
    const transport = isHttps ? https : http;
    const bodyStr = JSON.stringify({ emailOrLdapLoginId: email, password });

    return new Promise((resolve) => {
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || (isHttps ? 443 : 80),
            path: '/rest/login',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(bodyStr),
            },
            timeout: 10000,
        };
        const req = transport.request(options, (res) => {
            let data = '';
            res.on('data', d => { data += d; });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    const setCookieHeaders = res.headers['set-cookie'] || [];
                    const cookieStr = setCookieHeaders.map(c => c.split(';')[0]).join('; ');
                    if (cookieStr) {
                        _n8nSessionCache = { cookie: cookieStr, expiry: Date.now() + 8 * 3600 * 1000 };
                        console.log('🔑 n8n 세션 쿠키 발급됨 (8시간 캐시)');
                        resolve(cookieStr);
                    } else {
                        console.warn('⚠️  n8n 로그인 성공했으나 쿠키 없음');
                        resolve(null);
                    }
                } else {
                    console.warn(`⚠️  n8n 로그인 실패: HTTP ${res.statusCode}: ${data.slice(0, 100)}`);
                    resolve(null);
                }
            });
        });
        req.on('error', (e) => { console.warn(`⚠️  n8n 로그인 네트워크 오류: ${e.message}`); resolve(null); });
        req.on('timeout', () => { req.destroy(); resolve(null); });
        req.write(bodyStr);
        req.end();
    });
}

// Runtime mode: 'production' uses /webhook/, 'test' uses /webhook-test/
let n8nMode = 'production';

function getN8nUrl(stage) {
  const url = N8N_BASE_URLS[stage];
  if (!url) return null;
  // Strip any existing stage suffix and trailing slashes, then strip the mode segment
  const base = url
    .replace(/\/(sdr|tsd|tags)\/?$/, '')      // remove trailing stage path
    .replace(/\/$/, '')                        // remove trailing slash
    .replace(/\/webhook(?:-test)?$/, '');      // remove /webhook or /webhook-test
  // Reattach the correct mode segment and stage suffix from code
  const modeSegment = n8nMode === 'test' ? '/webhook-test' : '/webhook';
  return base + modeSegment + '/' + stage;
}

const app = express();

// â”€â”€ Python bridge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Spawn a Python or Node.js script, pipe inputJson via stdin, resolve with parsed stdout JSON.
 * Falls back gracefully: rejects with { error, stderr, stdout } on failure.
 */
function spawnPython(scriptName, inputJson, runtime = 'python3') {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(SCRIPTS_DIR, scriptName);
        const cmd = runtime === 'node' ? 'node' : PYTHON_CMD;
        const child = spawn(cmd, [scriptPath], { stdio: ['pipe', 'pipe', 'pipe'] });

        let stdout = '';
        let stderr = '';
        child.stdout.on('data', d => { stdout += d.toString(); });
        child.stderr.on('data', d => { stderr += d.toString(); });

        child.on('close', code => {
            const trimmed = stdout.trim();

            if (code !== 0) {
                // stdoutì— JSON ì—ëŸ¬ ì‘ë‹µì´ ìžˆìœ¼ë©´ ìš°ì„  ì‚¬ìš© (Python ìŠ¤í¬ë¦½íŠ¸ê°€ ì—ëŸ¬ JSONì„ ì¶œë ¥í•œ ê²½ìš°)
                if (trimmed) {
                    try { return resolve(JSON.parse(trimmed)); } catch (_) {}
                }
                return reject({ error: `Script exited with code ${code}`, stderr, stdout });
            }

            if (!trimmed) {
                return reject({
                    error: 'Script produced no output (empty stdout). Check stderr for details.',
                    stderr,
                    stdout: ''
                });
            }

            try {
                resolve(JSON.parse(trimmed));
            } catch (e) {
                reject({ error: `JSON parse failed: ${e.message}`, stderr, stdout: trimmed.slice(0, 500) });
            }
        });

        child.on('error', err => reject({ error: err.message }));

        const input = Buffer.from(JSON.stringify(inputJson));
        child.stdin.end(input);
    });
}

// â”€â”€ Helper (legacy ExcelJS fallback) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function getFieldValue(record, keys) {
    for (const key of keys) {
        const value = record?.[key];
        if (value !== undefined && value !== null && value !== '') {
            return value;
        }
    }

    return '';
}

// ì •ì  íŒŒì¼ ì„œë¹™
app.use(express.static('public'));

// JSON íŒŒì‹± (ëŒ€ìš©ëŸ‰ íŒŒì¼ ì§€ì›)
app.use(express.json({ limit: '50mb' }));

// ë¡œê¹… ë¯¸ë“¤ì›¨ì–´
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// ë©”ì¸ íŽ˜ì´ì§€
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// â”€â”€ /files: input/ í´ë”ì˜ xlsx íŒŒì¼ ëª©ë¡ ë°˜í™˜ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/files', (req, res) => {
    const inputDir = path.join(__dirname, 'input');
    if (!fs.existsSync(inputDir)) return res.json({ files: [] });
    const files = fs.readdirSync(inputDir)
        .filter(f => /\.(xlsx|xls|csv)$/i.test(f))
        .map(f => {
            const stat = fs.statSync(path.join(inputDir, f));
            return { name: f, size: stat.size, modified: stat.mtime.toISOString() };
        })
        .sort((a, b) => b.modified.localeCompare(a.modified));
    res.json({ files });
});

// â”€â”€ /trigger: BRD íŒŒì¼ì„ n8n ì›¹í›… íŠ¸ë¦¬ê±° â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// fileBase64 ì§ì ‘ ì „ë‹¬ ë˜ëŠ” fileNameìœ¼ë¡œ input/ í´ë”ì—ì„œ ì½ê¸° (í•˜ìœ„ í˜¸í™˜)
// ── n8n execution 강제 중단 ────────────────────────────────────────────────────
// BUG 1 fix: resolveN8nApiBase()로 API URL을 webhook URL과 분리해 Docker 네트워크 문제 해소
// BUG 2 fix: HTTP 응답 상태 코드를 읽어 실패 시 경고 로그 출력 (silent-swallow 제거)
async function stopN8nExecution(executionId) {
    if (!executionId) {
        console.warn('⚠️  stopN8nExecution: executionId가 null — n8n 워크플로우를 재임포트하거나');
        console.warn('    워크플로우가 실행 중인지 확인하세요.');
        console.warn('    → n8n UI: Workflows → SDR/TSD/Tags → ⋯ → Import from file');
        return false;
    }
    if (!N8N_API_KEY) {
        console.warn('⚠️  stopN8nExecution: N8N_API_KEY가 설정되지 않았습니다 (.env 확인)');
        return false;
    }
    const apiBase = resolveN8nApiBase();
    if (!apiBase) {
        console.warn('⚠️  stopN8nExecution: n8n API Base URL을 확인할 수 없습니다. (.env의 N8N_API_BASE_URL 또는 N8N_SDR_WEBHOOK_URL 확인)');
        return false;
    }
    try {
        const urlObj = new URL(apiBase);
        const isHttps = urlObj.protocol === 'https:';
        const transport = isHttps ? https : http;
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || (isHttps ? 443 : 80),
            path: `/api/v1/executions/${executionId}/stop`,
            method: 'POST',
            headers: { 'X-N8N-API-KEY': N8N_API_KEY, 'Content-Length': 0 },
            timeout: 10000,
        };
        const makeStopRequest = (reqOptions) => new Promise((resolve) => {
            const req = transport.request(reqOptions, (res) => {
                let body = '';
                res.on('data', d => { body += d; });
                res.on('end', () => resolve({ statusCode: res.statusCode, body }));
            });
            req.on('error', (err) => {
                console.warn(`⚠️  stopN8nExecution: 네트워크 오류 — ${err.message}`);
                resolve({ statusCode: null, body: '' });
            });
            req.on('timeout', () => { req.destroy(); resolve({ statusCode: null, body: '' }); });
            req.end();
        });

        // 1차: Public REST API (/api/v1/executions/{id}/stop) — API Key 인증
        const { statusCode, body: respBody } = await makeStopRequest(options);

        if (statusCode >= 200 && statusCode < 300) {
            console.log(`🛑 n8n execution stopped via public API (HTTP ${statusCode}): ${executionId}`);
            return true;
        }

        console.warn(`⚠️  stopN8nExecution: public API HTTP ${statusCode} for execution ${executionId}`);
        if (respBody) console.warn(`    Response: ${respBody.slice(0, 200)}`);

        // 2차: Public API가 404를 반환하면 두 가지 fallback 순서대로 시도
        // 원인 A: test-mode execution이 DB에 아직 기록되지 않은 타이밍 문제 (재시도로 해결)
        // 원인 B: 비활성 워크플로우 execution이 getAccessibleWorkflowIds() 에서 제외됨
        //         → 내부 REST API + X-N8N-API-KEY 로 해결
        //         (n8n v1.x: N8N_BASIC_AUTH_ACTIVE 제거됨 — REST API도 동일한 API 키 사용)
        if (statusCode === 404) {
            // 2a: public API 재시도 (3초 간격, 최대 3회) — DB 기록 지연(타이밍 이슈) 해소
            for (let attempt = 1; attempt <= 3; attempt++) {
                await new Promise(r => setTimeout(r, 3000));
                const { statusCode: retryCode, body: retryBody } = await makeStopRequest(options);
                if (retryCode >= 200 && retryCode < 300) {
                    console.log(`🛑 n8n execution stopped via public API retry #${attempt} (HTTP ${retryCode}): ${executionId}`);
                    return true;
                }
                if (retryCode !== 404) {
                    // 404가 아닌 다른 오류면 재시도 중단
                    console.warn(`⚠️  stopN8nExecution: retry #${attempt} — HTTP ${retryCode}: ${retryBody.slice(0, 100)}`);
                    break;
                }
                console.log(`🔄 stopN8nExecution: retry #${attempt}/3 — still 404, waiting...`);
            }

            // 2b: 내부 REST API (/rest/executions/{id}/stop) + session cookie fallback
            //     - n8n v1.x: /rest/ 엔드포인트는 X-N8N-API-KEY를 거부 → 세션 쿠키 필요
            //     - getN8nSessionCookie()가 이메일/비밀번호로 로그인 후 쿠키 반환 (8시간 캐시)
            console.log(`🔄 stopN8nExecution: internal REST API fallback 시도 (session cookie) ...`);
            const sessionCookie = await getN8nSessionCookie(apiBase);
            if (!sessionCookie) {
                console.warn('⚠️  stopN8nExecution: 세션 쿠키 획득 실패');
                console.warn('    → .env에 N8N_EMAIL, N8N_PASSWORD 설정 확인 (n8n-cloud/.env 와 동일하게)');
                return false;
            }
            const fallbackOptions = {
                hostname: urlObj.hostname,
                port: urlObj.port || (isHttps ? 443 : 80),
                path: `/rest/executions/${executionId}/stop`,
                method: 'POST',
                headers: {
                    'Cookie': sessionCookie,
                    'Content-Length': 0,
                },
                timeout: 10000,
            };
            const { statusCode: fbCode, body: fbBody } = await makeStopRequest(fallbackOptions);
            if (fbCode >= 200 && fbCode < 300) {
                console.log(`🛑 n8n execution stopped via internal REST API (HTTP ${fbCode}): ${executionId}`);
                return true;
            }
            // n8n이 실행이 이미 완료됐거나 존재하지 않을 때 500 반환 ("Failed to find execution to stop")
            if (fbCode === 500 && (fbBody.includes('Failed to find execution') || fbBody.includes('not found'))) {
                console.log(`ℹ️  stopN8nExecution: execution ${executionId} already finished or not found (HTTP 500)`)
                return false;
            }
            console.warn(`⚠️  stopN8nExecution: internal API HTTP ${fbCode}: ${fbBody.slice(0, 200)}`);
            if (fbCode === 401) {
                // 세션 만료 시 캐시 초기화해 다음 호출에서 재로그인
                _n8nSessionCache = { cookie: null, expiry: 0 };
                console.warn('    → 세션 만료. 캐시 초기화 — 다음 stop 시도 시 재로그인합니다.');
            }
        }

        return false;
    } catch (e) {
        console.warn(`⚠️  stopN8nExecution exception: ${e.message}`);
        return false;
    }
}

// ── Helper: n8n API에서 현재 running 중인 가장 최근 execution ID 조회 ──────────────────────
// n8n 웹훅 응답에 executionId가 없을 때 fallback으로 사용
// BUG 4 fix: workflowNames 파라미터로 특정 워크플로우만 필터링해 잘못된 execution 매핑 방지
// BUG 1 fix: resolveN8nApiBase() 사용으로 Docker 네트워크 문제 해소
async function fetchLatestRunningExecutionId(workflowNames = ['sdr', 'tsd', 'tags', 'document ai']) {
    if (!N8N_API_KEY) return null;
    const apiBase = resolveN8nApiBase();
    if (!apiBase) return null;
    try {
        const urlObj = new URL(apiBase);
        const isHttps = urlObj.protocol === 'https:';
        const transport = isHttps ? https : http;

        const makeQuery = (apiPath) => new Promise((resolve) => {
            const opts = {
                hostname: urlObj.hostname,
                port: urlObj.port || (isHttps ? 443 : 80),
                path: apiPath,
                method: 'GET',
                headers: { 'X-N8N-API-KEY': N8N_API_KEY, 'Accept': 'application/json' },
                timeout: 5000,
            };
            const req = transport.request(opts, (res) => {
                let data = '';
                res.on('data', chunk => { data += chunk; });
                res.on('end', () => { try { resolve(JSON.parse(data)); } catch (_) { resolve(null); } });
            });
            req.on('error', () => resolve(null));
            req.on('timeout', () => { req.destroy(); resolve(null); });
            req.end();
        });

        // 워크플로우 이름 기반 필터 함수 (BUG 4: 엉뚱한 execution 매핑 방지)
        const matchesWorkflow = (exec) => {
            const wfName = (exec?.workflowData?.name || exec?.workflow?.name || '').toLowerCase();
            return !wfName || workflowNames.some(n => wfName.includes(n.toLowerCase()));
        };

        // 1차: status=running 필터 (프로덕션 모드)
        const runningBody = await makeQuery('/api/v1/executions?status=running&limit=10');
        const runningExecs = (runningBody?.data || []).filter(matchesWorkflow);
        if (runningExecs.length > 0) return runningExecs[0]?.id?.toString() || null;

        // 2차: 테스트 모드 등 status=running이 잡히지 않을 때 — 최근 실행 조회 후 running 필터
        const allBody = await makeQuery('/api/v1/executions?limit=20');
        const allExecs = allBody?.data || [];
        const active = allExecs.find(e =>
            (e.status === 'running' || e.finished === false) && matchesWorkflow(e)
        );
        return active?.id?.toString() || null;
    } catch (_) {
        return null;
    }
}

// ── Shared: call n8n webhook and register job ──────────────────────────────────────────────────────────────────────────────────
async function callN8nAndRegisterJob(webhookUrl, payload, jobMeta) {
    const urlObj = new URL(webhookUrl);
    const isHttps = urlObj.protocol === 'https:';
    const transport = isHttps ? https : http;
    const payloadStr = JSON.stringify(payload);
    const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payloadStr) },
        timeout: 60000,
    };

    console.log('⏳ Calling n8n webhook:', webhookUrl);
    console.log('options:', options);

    const n8nResponse = await new Promise((resolve, reject) => {
        const request = transport.request(options, (response) => {
            let data = '';
            response.on('data', chunk => { data += chunk; });
            response.on('end', () => {
                try { resolve({ statusCode: response.statusCode, body: JSON.parse(data) }); }
                catch { resolve({ statusCode: response.statusCode, body: { raw: data } }); }
            });
        });
        request.on('error', reject);
        request.on('timeout', () => { request.destroy(); reject(new Error('Request timeout')); });
        request.write(payloadStr);
        request.end();
    });
    const jobId = n8nResponse.body?.jobId || ('local-' + Date.now());
    const n8nExecutionId = n8nResponse.body?.executionId || n8nResponse.body?.id || null;
    const now = new Date().toISOString();
    jobs.set(jobId, { jobId, status: 'processing', createdAt: now, updatedAt: now, result: null, error: null, n8nExecutionId, ...jobMeta });
    console.log('✅ Job registered: ' + jobId + ' (stage: ' + (jobMeta.stage || 'unknown') + ', executionId: ' + (n8nExecutionId || 'pending...') + ')');

    // n8n 응답에 executionId가 없으면 2초 후 n8n API에서 조회 (fallback)
    if (!n8nExecutionId && N8N_API_KEY) {
        setTimeout(async () => {
            const job = jobs.get(jobId);
            if (!job || job.n8nExecutionId || ['completed', 'failed', 'cancelled'].includes(job.status)) return;
            const id = await fetchLatestRunningExecutionId();
            if (id) {
                job.n8nExecutionId = id;
                jobs.set(jobId, job);
                console.log(`🔗 executionId resolved (fallback): ${jobId} → ${id}`);
            } else {
                console.warn(`⚠️  executionId fallback failed for job: ${jobId}`);
            }
        }, 2000);
    }

    return { jobId, n8nResponse };
}

// ── /trigger  (legacy alias → /trigger/sdr, 하위 호환) ──────────────────────────────────────────────
app.post('/trigger', async (req, res) => {
    req.url = '/trigger/sdr';
    return app._router.handle(req, res, () => {});
});

// ── /trigger/sdr: BRD Excel → SDR 워크플로우 트리거 ──────────────────────────────────────────────────
app.post('/trigger/sdr', async (req, res) => {
    try {
        const { fileName, clientName, fileBase64: bodyBase64, baseSheetName } = req.body;
        if (!fileName) return res.status(400).json({ error: 'fileName required' });
        if (!baseSheetName) return res.status(400).json({ error: 'baseSheetName required' });

        let base64;
        if (bodyBase64) {
            base64 = bodyBase64;
        } else {
            const filePath = path.join(__dirname, 'input', fileName);
            if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found: ' + fileName });
            base64 = fs.readFileSync(filePath).toString('base64');
        }

        const derivedClient = clientName || fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
        const webhookUrl = getN8nUrl('sdr');
        if (!webhookUrl) return res.status(500).json({ error: 'N8N_SDR_WEBHOOK_URL (or N8N_WEBHOOK_URL) not set in .env' });

        const CALLBACK_HOST = process.env.CALLBACK_HOST || 'host.docker.internal';
        const callbackUrl = 'http://' + CALLBACK_HOST + ':' + PORT + '/webhook/sdr-result';
        const now = new Date().toISOString();

        console.log('🚀 SDR trigger: client="' + derivedClient + '", file="' + fileName + '" (' + (base64.length/1024).toFixed(1) + ' KB)');

        const { jobId } = await callN8nAndRegisterJob(webhookUrl,
            { clientName: derivedClient, fileName, fileBase64: base64, baseSheetName, callbackUrl },
            { clientName: derivedClient, fileName, stage: 'sdr',
              steps: [
                { step: 1, name: 'trigger', status: 'completed', updatedAt: now },
                { step: 2, name: 'sdr',     status: 'active',    updatedAt: now },
                { step: 3, name: 'excel',   status: 'pending',   updatedAt: null },
              ]
            }
        );

        res.json({ success: true, jobId, clientName: derivedClient, stage: 'sdr', message: 'SDR 생성이 시작되었습니다.' });
    } catch (err) {
        console.error('❌ /trigger/sdr error:', err.message || err);
        res.status(500).json({ error: err.message || String(err) });
    }
});

// ── /trigger/tsd: sdrData JSON → TSD 워크플로우 트리거 ──────────────────────────────────────────────
app.post('/trigger/tsd', async (req, res) => {
    try {
        const { clientName, sdrData, jobId: existingJobId } = req.body;
        if (!clientName) return res.status(400).json({ error: 'clientName required' });
        if (!sdrData)    return res.status(400).json({ error: 'sdrData required' });
        if (!sdrData.evars || !sdrData.props || !sdrData.events) {
            return res.status(400).json({ error: 'sdrData must contain evars, props, and events' });
        }

        const webhookUrl = getN8nUrl('tsd');
        if (!webhookUrl) return res.status(500).json({ error: 'N8N_TSD_WEBHOOK_URL not set in .env' });

        const CALLBACK_HOST = process.env.CALLBACK_HOST || 'host.docker.internal';
        const callbackUrl = 'http://' + CALLBACK_HOST + ':' + PORT + '/webhook/sdr-result';
        const now = new Date().toISOString();

        console.log('🚀 TSD trigger: client="' + clientName + '", eVars=' + sdrData.evars.length + ', Events=' + sdrData.events.length);

        const { jobId } = await callN8nAndRegisterJob(webhookUrl,
            { clientName, sdrData, callbackUrl, jobId: existingJobId },
            { clientName, stage: 'tsd',
              steps: [
                { step: 1, name: 'trigger',  status: 'completed', updatedAt: now },
                { step: 2, name: 'tsd_ai',   status: 'active',    updatedAt: now },
                { step: 3, name: 'tsd_docx', status: 'pending',   updatedAt: null },
              ]
            }
        );

        res.json({ success: true, jobId, clientName, stage: 'tsd', message: 'TSD 생성이 시작되었습니다.' });
    } catch (err) {
        console.error('❌ /trigger/tsd error:', err.message || err);
        res.status(500).json({ error: err.message || String(err) });
    }
});

// ── /trigger/tags: sdrData JSON → Tags(Adobe Launch) 워크플로우 트리거 ────────────────────────────────
app.post('/trigger/tags', async (req, res) => {
    try {
        const { clientName, sdrData, jobId: existingJobId } = req.body;
        if (!clientName) return res.status(400).json({ error: 'clientName required' });
        if (!sdrData)    return res.status(400).json({ error: 'sdrData required' });
        if (!sdrData.evars || !sdrData.events) {
            return res.status(400).json({ error: 'sdrData must contain evars and events for Tags creation' });
        }

        const webhookUrl = getN8nUrl('tags');
        if (!webhookUrl) return res.status(500).json({ error: 'N8N_TAGS_WEBHOOK_URL not set in .env' });

        const CALLBACK_HOST = process.env.CALLBACK_HOST || 'host.docker.internal';
        const callbackUrl = 'http://' + CALLBACK_HOST + ':' + PORT + '/webhook/sdr-result';
        const now = new Date().toISOString();

        console.log('🚀 Tags trigger: client="' + clientName + '", eVars=' + sdrData.evars.length + ', Events=' + sdrData.events.length);

        const { jobId } = await callN8nAndRegisterJob(webhookUrl,
            { clientName, sdrData, callbackUrl, jobId: existingJobId },
            { clientName, stage: 'tags',
              steps: [
                { step: 1, name: 'trigger',     status: 'completed', updatedAt: now },
                { step: 2, name: 'tags_create',  status: 'active',    updatedAt: now },
              ]
            }
        );

        res.json({ success: true, jobId, clientName, stage: 'tags', message: 'Tags 생성이 시작되었습니다.' });
    } catch (err) {
        console.error('❌ /trigger/tags error:', err.message || err);
        res.status(500).json({ error: err.message || String(err) });
    }
});


// start callback → activate only / done callback → complete only
const STEP_TRANSITIONS = {
    // SDR workflow callbacks
    'step_sdr_done':    { complete: 'sdr'                    },
    'step_excel_start': {                 activate: 'excel'  },
    'step_excel_done':  { complete: 'excel'                  },
    // TSD workflow callbacks
    'step_tsd_start':   {                 activate: 'tsd_ai' },
    'step_tsd_done':    { complete: 'tsd_ai', activate: 'tsd_docx' },
    // Tags workflow callbacks
    'step_tags_start':  {                 activate: 'tags_create' },
    // legacy / shared
    'step_done_start':  {                 activate: 'done'   },
};

// â”€â”€ /webhook/sdr-result: n8n ë‹¨ê³„ë³„ ì½œë°± ë° ì™„ë£Œ ì½œë°± ìˆ˜ì‹  â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.post('/webhook/sdr-result', (req, res) => {
    const body = req.body;
    const jobId = body.jobId || body.job_id;
    const cbStatus = body.status || 'completed';

    console.log(`ðŸ“¥ Callback received: jobId=${jobId}, status=${cbStatus}`);

    if (jobId) {
        // 취소된 job은 콜백 무시
        const existingForCheck = jobs.get(jobId);
        if (existingForCheck && existingForCheck.status === 'cancelled') {
            console.log(`⏭️  Callback ignored (job cancelled): ${jobId}`);
            return res.json({ received: true, ignored: true });
        }

        const cbNow = new Date().toISOString();
        const existing = existingForCheck || { jobId, createdAt: cbNow };
        const updated = { ...existing, updatedAt: cbNow };

        // 콜백에 executionId가 포함돼 있으면 즉시 저장 (초기 응답에서 못 받은 경우 보완)
        if (body.executionId && !updated.n8nExecutionId) {
            updated.n8nExecutionId = body.executionId;
            console.log(`🔗 executionId captured from callback: ${body.executionId} (jobId: ${jobId})`);
        }

        if (STEP_TRANSITIONS[cbStatus]) {
            // 단계 진행 콜백: 해당 step → completed, 다음 step → active
            const { complete, activate } = STEP_TRANSITIONS[cbStatus];
            if (updated.steps) {
                updated.steps = updated.steps.map(s => {
                    if (s.name === complete) return { ...s, status: 'completed', updatedAt: cbNow };
                    if (s.name === activate) return { ...s, status: 'active',    updatedAt: cbNow };
                    return s;
                });
            }
            // Auto-complete: 모든 step이 완료되면 job status도 completed로 전환
            if (updated.steps && updated.steps.every(s => s.status === 'completed')) {
                updated.status = 'completed';
                updated.result = body;
            } else {
                updated.status = 'processing';
            }
        } else if (cbStatus === 'completed') {
            updated.status = 'completed';

            // ── Fix 4: sdrJson → sdrData 정규화 ──────────────────────────────────
            // SDR Notify Callback 은 sdrJson 필드로 전달하지만,
            // TSD /trigger/tsd 는 sdrData 필드를 기대함.
            // completed 수신 시 sdrJson 을 sdrData 로 통일해 UI·TSD 모두 동일한 키로 접근 가능하게 함.
            if (body.sdrJson && !body.sdrData) {
                body.sdrData = body.sdrJson;
                console.log(`🔄 sdrJson → sdrData 정규화 완료 (jobId: ${jobId})`);
            }

            updated.result = body;
            if (updated.steps) {
                updated.steps = updated.steps.map(s => ({ ...s, status: 'completed', updatedAt: cbNow }));
            }

            // ── Fix 5·6: SDR 완료 후 TSD 자동 체인 ──────────────────────────────
            // AUTO_CHAIN_TSD=true 이고, job이 SDR 단계이며, TSD URL이 설정된 경우에만 동작.
            // sdrData에 section_a_ootb, data_layer_map, brd_traceability 등 전체 필드를 포함해
            // TSD 프롬프트 품질을 보장함 (Fix 6).
            if (AUTO_CHAIN_TSD && updated.stage === 'sdr' && getN8nUrl('tsd') && body.sdrData) {
                const sdrData = body.sdrData;
                const clientName = body.clientName || updated.clientName;
                if (clientName && sdrData && sdrData.evars && sdrData.props && sdrData.events) {
                    const CALLBACK_HOST = process.env.CALLBACK_HOST || 'host.docker.internal';
                    const tsdCallbackUrl = 'http://' + CALLBACK_HOST + ':' + PORT + '/webhook/sdr-result';
                    const tsdPayload = { clientName, sdrData, callbackUrl: tsdCallbackUrl, jobId };
                    console.log(`🔗 AUTO_CHAIN_TSD: SDR 완료 → TSD 자동 트리거 (client="${clientName}")`);
                    const now2 = new Date().toISOString();
                    callN8nAndRegisterJob(getN8nUrl('tsd'), tsdPayload, {
                        clientName, stage: 'tsd',
                        steps: [
                            { step: 1, name: 'trigger',  status: 'completed', updatedAt: now2 },
                            { step: 2, name: 'tsd_ai',   status: 'active',    updatedAt: now2 },
                            { step: 3, name: 'tsd_docx', status: 'pending',   updatedAt: null },
                        ]
                    }).then(({ jobId: tsdJobId }) => {
                        console.log(`✅ AUTO_CHAIN_TSD: TSD job 등록 완료 → tsdJobId=${tsdJobId}`);
                        // 원래 SDR job에 tsdJobId 연결 정보 저장
                        const sdrJob = jobs.get(jobId);
                        if (sdrJob) { sdrJob.tsdJobId = tsdJobId; jobs.set(jobId, sdrJob); }
                    }).catch(err => {
                        console.error(`❌ AUTO_CHAIN_TSD: TSD 트리거 실패 — ${err.message || err}`);
                    });
                } else {
                    console.warn(`⚠️  AUTO_CHAIN_TSD: sdrData 또는 clientName 누락으로 자동 체인 스킵 (jobId: ${jobId})`);
                }
            }
        } else if (cbStatus === 'failed') {
            updated.status = 'failed';
            updated.error = body.error || 'Unknown error';
        } else {
            updated.status = cbStatus;
        }

        jobs.set(jobId, updated);

        // SSE ë¸Œë¡œë“œìºìŠ¤íŠ¸
        const clients = sseClients.get(jobId);
        if (clients) {
            const event = `data: ${JSON.stringify(updated)}\n\n`;
            clients.forEach(clientRes => { try { clientRes.write(event); } catch (_) {} });
        }
    }

    res.json({ received: true });
});

// â”€â”€ /webhook/step-update: n8n ë‹¨ê³„ë³„ ì§„í–‰ ìƒí™© ìˆ˜ì‹  â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.post('/webhook/step-update', (req, res) => {
    const { jobId, step, status, message } = req.body;

    if (!jobId || step === undefined || !status) {
        return res.status(400).json({ error: 'Missing required fields: jobId, step, status' });
    }

    const job = jobs.get(jobId);
    if (!job) {
        console.warn(`âš ï¸  Step update for unknown jobId: ${jobId}`);
        return res.status(404).json({ error: 'Job not found' });
    }    // 취소된 job은 step 업데이트 무시
    if (job.status === 'cancelled') {
        console.log(`⏭️  Step update ignored (job cancelled): ${jobId}`);
        return res.json({ received: true, ignored: true });
    }
    const now = new Date().toISOString();
    const stepNum = Number(step);

    // steps ë°°ì—´ì´ ì—†ìœ¼ë©´ ì´ˆê¸°í™”
    if (!job.steps) {
        job.steps = [
            { step: 1, name: 'trigger', status: 'completed', updatedAt: now },
            { step: 2, name: 'sdr',     status: 'pending',   updatedAt: null },
            { step: 3, name: 'excel',   status: 'pending',   updatedAt: null },
            { step: 4, name: 'tsd',     status: 'pending',   updatedAt: null },
            { step: 5, name: 'done',    status: 'pending',   updatedAt: null },
        ];
    }

    // 'active' ìˆ˜ì‹  ì‹œ ì´ì „ ë‹¨ê³„ë“¤ì„ ëª¨ë‘ completed ì²˜ë¦¬
    if (status === 'active') {
        job.steps.forEach(s => {
            if (s.step < stepNum && s.status === 'pending') {
                s.status = 'completed';
                s.updatedAt = now;
            }
        });
    }

    // í•´ë‹¹ ë‹¨ê³„ ì—…ë°ì´íŠ¸
    const target = job.steps.find(s => s.step === stepNum);
    if (target) {
        target.status = status;
        target.updatedAt = now;
        if (message) target.message = message;
    }

    // step 5 completed â†’ ìž¡ ì™„ë£Œ
    if (stepNum === 5 && status === 'completed') {
        job.status = 'completed';
    }

    // ì‹¤íŒ¨ ì²˜ë¦¬
    if (status === 'failed') {
        job.status = 'failed';
        job.error = message || `Step ${step} failed`;
    }

    job.updatedAt = now;
    jobs.set(jobId, job);
    console.log(`ðŸ“Š Step update: jobId=${jobId}, step=${step}, status=${status}`);

    // SSE ë¸Œë¡œë“œìºìŠ¤íŠ¸
    const clients = sseClients.get(jobId);
    if (clients) {
        const event = `data: ${JSON.stringify(job)}\n\n`;
        clients.forEach(clientRes => { try { clientRes.write(event); } catch (_) {} });
    }

    res.json({ received: true, step: stepNum, status });
});

// â”€â”€ /status/:jobId: ìž¡ ìƒíƒœ ì¡°íšŒ (í´ë§ìš©) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/status/:jobId', (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
});

// â”€â”€ /events/:jobId: Server-Sent Events (ì‹¤ì‹œê°„ ìƒíƒœ ìŠ¤íŠ¸ë¦¼) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/events/:jobId', (req, res) => {
    const { jobId } = req.params;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    if (!sseClients.has(jobId)) sseClients.set(jobId, new Set());
    sseClients.get(jobId).add(res);

    // í˜„ìž¬ ìƒíƒœ ì¦‰ì‹œ ì „ì†¡
    const current = jobs.get(jobId);
    if (current) res.write(`data: ${JSON.stringify(current)}\n\n`);

    // heartbeat (ì—°ê²° ìœ ì§€)
    const hb = setInterval(() => { try { res.write(': heartbeat\n\n'); } catch (_) {} }, 15000);

    req.on('close', () => {
        clearInterval(hb);
        const clients = sseClients.get(jobId);
        if (clients) { clients.delete(res); if (clients.size === 0) sseClients.delete(jobId); }
    });
});

// â”€â”€ /jobs: ì „ì²´ ìž¡ ëª©ë¡ (ìµœê·¼ 20ê°œ) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/jobs', (req, res) => {
    const list = [...jobs.values()]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 20);
    res.json({ jobs: list });
});

// â”€â”€ DELETE /jobs: ì „ì²´ ìž¡ ì‚­ì œ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.delete('/jobs', (req, res) => {
    const count = jobs.size;
    // ëª¨ë“  SSE í´ë¼ì´ì–¸íŠ¸ ì¢…ë£Œ
    sseClients.forEach(clients => {
        clients.forEach(clientRes => { try { clientRes.end(); } catch (_) {} });
    });
    sseClients.clear();
    jobs.clear();
    console.log(`ðŸ—‘ï¸  All jobs deleted: ${count} removed`);
    res.json({ deleted: true, count });
});

// â”€â”€ DELETE /jobs/:jobId: ê°œë³„ ìž¡ ì‚­ì œ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.delete('/jobs/:jobId', (req, res) => {
    const { jobId } = req.params;
    if (!jobs.has(jobId)) return res.status(404).json({ error: 'Job not found' });
    // SSE í´ë¼ì´ì–¸íŠ¸ ì¢…ë£Œ
    const clients = sseClients.get(jobId);
    if (clients) {
        clients.forEach(clientRes => { try { clientRes.end(); } catch (_) {} });
        sseClients.delete(jobId);
    }
    jobs.delete(jobId);
    console.log(`ðŸ—‘ï¸  Job deleted: ${jobId}`);
    res.json({ deleted: true, jobId });
});
// -- POST /jobs/:jobId/cancel: 실행 중인 job 취소 ------------------------------------------
app.post('/jobs/:jobId/cancel', async (req, res) => {
    const { jobId } = req.params;
    const job = jobs.get(jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (['completed', 'failed', 'cancelled'].includes(job.status)) {
        return res.status(409).json({ error: `Job already in terminal state: ${job.status}` });
    }

    const now = new Date().toISOString();
    job.status = 'cancelled';
    job.updatedAt = now;
    job.error = 'Cancelled by user.';
    if (job.steps) {
        job.steps = job.steps.map(s =>
            (s.status === 'active' || s.status === 'pending')
                ? { ...s, status: 'cancelled', updatedAt: now }
                : s
        );
    }
    jobs.set(jobId, job);
    console.log(`Job cancelled: ${jobId}`);

    // SSE로 cancelled 상태 즉시 브로드캐스트 후 연결 종료
    const cancelClients = sseClients.get(jobId);
    if (cancelClients) {
        const event = `data: ${JSON.stringify(job)}\n\n`;
        cancelClients.forEach(clientRes => {
            try { clientRes.write(event); clientRes.end(); } catch (_) {}
        });
        sseClients.delete(jobId);
    }

    // n8n execution 비동기 중단
    // BUG 3 fix: executionId가 null이면 즉시 n8n API 조회 후 stop (2초 setTimeout 의존 제거)
    (async () => {
        let execId = job.n8nExecutionId;
        if (!execId && N8N_API_KEY) {
            console.log(`🔍 cancel: n8nExecutionId 없음 — n8n API에서 즉시 조회 시도 (jobId: ${jobId})`);
            execId = await fetchLatestRunningExecutionId();
            if (execId) {
                job.n8nExecutionId = execId;
                jobs.set(jobId, job);
                console.log(`🔗 cancel: executionId 즉시 조회 성공: ${execId}`);
            } else {
                console.warn(`⚠️  cancel: executionId 조회 실패 — n8n 워크플로우가 이미 종료됐거나 연결 문제 (jobId: ${jobId})`);
            }
        }
        if (execId) {
            await stopN8nExecution(execId);
        }
    })().catch(() => {});

    res.json({ cancelled: true, jobId });
});
// â”€â”€ /sheets: base64 ì—‘ì…€ì—ì„œ ì‹œíŠ¸ëª… ëª©ë¡ ë°˜í™˜ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.post('/sheets', async (req, res) => {
    try {
        const { base64 } = req.body;
        if (!base64) return res.status(400).json({ error: 'Missing base64' });
        const buffer = Buffer.from(base64, 'base64');
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const sheets = workbook.worksheets.map(ws => ws.name);
        res.json({ sheets });
    } catch (err) {
        console.error('âŒ /sheets error:', err);
        res.status(500).json({ error: err.message });
    }
});

// â”€â”€ /parse-excel: Auto-detect headers and return rows as JSON â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.post('/parse-excel', async (req, res) => {
    try {
        const { base64, sheetName, keywords } = req.body;
        if (!base64) return res.status(400).json({ error: 'Missing base64' });

        const result = await spawnPython('parse_excel.py', { base64, sheetName: sheetName || null, keywords });
        res.json(result);
    } catch (err) {
        console.error('âŒ /parse-excel error:', err);
        res.status(500).json({ error: err.error || String(err), stderr: err.stderr });
    }
});

// â”€â”€ /generate-excel: Python-first, ExcelJS fallback â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.post('/generate-excel', async (req, res) => {
    try {
        const { originalFileBase64, sdrData, clientName } = req.body;

        if (!originalFileBase64 || !sdrData || !clientName) {
            return res.status(400).json({
                error: 'Missing required fields: originalFileBase64, sdrData, clientName'
            });
        }

        console.log(`ðŸ“ Processing Excel for "${clientName}"...`);
        console.log(`   eVars: ${sdrData.evars?.length || 0}`);
        console.log(`   Props: ${sdrData.props?.length || 0}`);
        console.log(`   Events: ${sdrData.events?.length || 0}`);

        // â”€â”€ Python path (auto-detect headers, no hardcoded layout) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        let outputBuffer;
        let usedPython = false;
        try {
            const pyResult = await spawnPython('generate_excel.py', {
                base64: originalFileBase64,
                clientName,
                sdrData,
            });
            if (!pyResult.success) throw new Error(pyResult.error || 'Python returned failure');
            outputBuffer = Buffer.from(pyResult.base64, 'base64');
            usedPython = true;
            console.log(`   âœ… Python wrote: evars=${pyResult.stats?.evars}, props=${pyResult.stats?.props}, events=${pyResult.stats?.events}, ootb=${pyResult.stats?.section_a_ootb ?? 0}`);
        } catch (pyErr) {
            console.warn(`   âš ï¸  Python path failed (${pyErr.error || pyErr}), falling back to ExcelJS...`);
            if (pyErr.stderr) console.warn(`   stderr: ${pyErr.stderr}`);
        }

        // â”€â”€ ExcelJS fallback (hardcoded layout: row 7, columns 2-9) â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if (!usedPython) {
            const buffer = Buffer.from(originalFileBase64, 'base64');
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(buffer);
            console.log(`   Loaded workbook with ${workbook.worksheets.length} sheets`);

            if (sdrData.evars?.length) {
                const wsEvars = workbook.getWorksheet(SHEET_NAMES.evars);
                if (wsEvars) {
                    clearDataRows(wsEvars, 7);
                    sdrData.evars.forEach((evar, index) => {
                        const row = wsEvars.getRow(7 + index);
                        row.getCell(2).value = getFieldValue(evar, ['Requirement ID', 'req_id']);
                        row.getCell(3).value = getFieldValue(evar, ['Analytics Variable', 'variable']);
                        row.getCell(4).value = getFieldValue(evar, ['Variable Name', 'variable_name']);
                        row.getCell(5).value = getFieldValue(evar, ['Variable Description', 'variable_description']);
                        row.getCell(6).value = getFieldValue(evar, ['Value Format', 'value_format']);
                        row.getCell(7).value = getFieldValue(evar, ['Example Value', 'example_value']);
                        row.getCell(8).value = getFieldValue(evar, ['eVar Allocation', 'allocation']);
                        row.getCell(9).value = getFieldValue(evar, ['eVar Expiration', 'expiration']);
                        row.commit();
                    });
                }
            }
            if (sdrData.props?.length) {
                const wsProps = workbook.getWorksheet(SHEET_NAMES.props);
                if (wsProps) {
                    clearDataRows(wsProps, 7);
                    sdrData.props.forEach((prop, index) => {
                        const row = wsProps.getRow(7 + index);
                        row.getCell(2).value = getFieldValue(prop, ['Requirement ID', 'req_id']);
                        row.getCell(3).value = getFieldValue(prop, ['Analytics Variable', 'variable']);
                        row.getCell(4).value = getFieldValue(prop, ['Variable Name', 'variable_name']);
                        row.getCell(5).value = getFieldValue(prop, ['Variable Description', 'variable_description']);
                        row.getCell(6).value = getFieldValue(prop, ['Value Format', 'value_format']);
                        row.getCell(7).value = getFieldValue(prop, ['Example Value', 'example_value']);
                        row.getCell(8).value = getFieldValue(prop, ['Additional Notes', 'capture_method', 'group']);
                        row.getCell(9).value = '';
                        row.commit();
                    });
                }
            }
            if (sdrData.events?.length) {
                const wsEvents = workbook.getWorksheet(SHEET_NAMES.events);
                if (wsEvents) {
                    clearDataRows(wsEvents, 7);
                    sdrData.events.forEach((event, index) => {
                        const row = wsEvents.getRow(7 + index);
                        row.getCell(2).value = getFieldValue(event, ['Requirement ID', 'req_id']);
                        row.getCell(3).value = getFieldValue(event, ['Event', 'event']);
                        row.getCell(4).value = getFieldValue(event, ['Event Name', 'event_name']);
                        row.getCell(5).value = getFieldValue(event, ['Event Description', 'event_description']);
                        row.getCell(6).value = getFieldValue(event, ['Event Type', 'event_type']);
                        row.getCell(7).value = '';
                        row.getCell(8).value = '';
                        row.getCell(9).value = '';
                        row.commit();
                    });
                }
            }
            outputBuffer = await workbook.xlsx.writeBuffer();
        }
        
        // íŒŒì¼ëª… ìƒì„± (ì—°ì›”ì¼ì‹œë¶„ í¬ë§·)
        const now = new Date();
        const timestamp = now.toISOString()
            .replace(/T/, '_')
            .replace(/:/g, '')
            .replace(/\.\d+Z$/, '')
            .substring(0, 15); // YYYY-MM-DD_HHmm
        const safeClientName = clientName.replace(/[^a-zA-Z0-9]/g, '_');
        const filename = `SDR_${safeClientName}_${timestamp}.xlsx`;

        // output ë””ë ‰í† ë¦¬ í™•ì¸ ë° ìƒì„±
        const outputDir = path.join(__dirname, 'output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // íŒŒì¼ ì €ìž¥
        const outputPath = path.join(outputDir, filename);
        fs.writeFileSync(outputPath, outputBuffer);
        console.log(`   ðŸ’¾ Saved to: ${outputPath}`);
        
        // ë‹¤ìš´ë¡œë“œ ì‘ë‹µ
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(outputBuffer);
        
        console.log(`âœ… Excel generated successfully: ${filename}`);
        console.log(`   File size: ${(outputBuffer.length / 1024).toFixed(2)} KB`);
    } catch (error) {
        console.error('âŒ Error generating Excel:', error);
        res.status(500).json({ 
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Helper: ë°ì´í„° í–‰ í´ë¦¬ì–´ (Row 7ë¶€í„°)
function clearDataRows(worksheet, startRow) {
    const maxRow = worksheet.rowCount;
    for (let i = startRow; i <= maxRow; i++) {
        const row = worksheet.getRow(i);
        for (let j = 2; j <= 9; j++) {  // B~I ì—´ (2~9)
            row.getCell(j).value = null;
        }
        row.commit();
    }
}

// â”€â”€ /generate-tsd: TSD markdown â†’ .docx â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.post('/generate-tsd', async (req, res) => {
    try {
        const { clientName, markdown, javascript } = req.body;

        if (!clientName || !markdown) {
            return res.status(400).json({ error: 'Missing required fields: clientName, markdown' });
        }

        console.log(`ðŸ“„ Generating TSD .docx for "${clientName}"...`);

        const result = await spawnPython('generate_tsd.js', { clientName, markdown, javascript: javascript || '' }, 'node');
        if (!result.success) throw new Error(result.error || 'generate_tsd.js returned failure');

        const outputBuffer = Buffer.from(result.base64, 'base64');

        const now = new Date();
        const timestamp = now.toISOString()
            .replace(/T/, '_').replace(/:/g, '').replace(/\.\d+Z$/, '').substring(0, 15);
        const safeClientName = clientName.replace(/[^a-zA-Z0-9]/g, '_');
        const filename = `TSD_${safeClientName}_${timestamp}.docx`;

        const outputDir = path.join(__dirname, 'output');
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
        fs.writeFileSync(path.join(outputDir, filename), outputBuffer);
        console.log(`   âœ… TSD .docx generated: ${filename} (${(outputBuffer.length / 1024).toFixed(1)} KB, ${result.sectionCount} sections)`);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(outputBuffer);
    } catch (error) {
        console.error('âŒ Error generating TSD:', error);
        res.status(500).json({ error: error.message });
    }
});

// ── /api/n8n-mode: n8n 웹훅 모드 조회/변경 ─────────────────────────────────
app.get('/api/n8n-mode', (req, res) => {
    res.json({
        mode: n8nMode,
        urls: { sdr: getN8nUrl('sdr'), tsd: getN8nUrl('tsd'), tags: getN8nUrl('tags') }
    });
});

app.post('/api/n8n-mode', (req, res) => {
    const { mode } = req.body;
    if (!['production', 'test'].includes(mode)) {
        return res.status(400).json({ error: 'mode must be "production" or "test"' });
    }
    n8nMode = mode;
    console.log(`🔀 n8n mode switched to: ${mode}`);
    res.json({ mode, urls: { sdr: getN8nUrl('sdr'), tsd: getN8nUrl('tsd'), tags: getN8nUrl('tags') } });
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'excel-generator',
        version: '1.3.0',
        n8nCompatibility: 'v1.3',
        uptime: process.uptime(),
        activeJobs: [...jobs.values()].filter(j => j.status === 'processing').length,
        totalJobs: jobs.size,
        n8nMode: n8nMode
    });
});

// ì„œë²„ ì‹œìž‘
app.listen(PORT, () => {
    console.log('');
    console.log('ðŸš€ Adobe Excel Service v0.8 started');
    console.log('================================================');
    console.log(`   Web UI:  http://localhost:${PORT}/`);
    console.log(`   API:     http://localhost:${PORT}/generate-excel`);
    console.log(`   Health:  http://localhost:${PORT}/health`);
    console.log('================================================');
    console.log(`   Python:  ${PYTHON_CMD}`);
    console.log(`   Sheet Names:`);
    console.log(`     eVars:  ${SHEET_NAMES.evars}`);
    console.log(`     Props:  ${SHEET_NAMES.props}`);
    console.log(`     Events: ${SHEET_NAMES.events}`);
    console.log('================================================');
    console.log('');
});


