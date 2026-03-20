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
// ── Shared: call n8n webhook and register job ──────────────────────────────────────────────────────
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
    const now = new Date().toISOString();
    jobs.set(jobId, { jobId, status: 'processing', createdAt: now, updatedAt: now, result: null, error: null, ...jobMeta });
    console.log('✅ Job registered: ' + jobId + ' (stage: ' + (jobMeta.stage || 'unknown') + ')');
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
        const cbNow = new Date().toISOString();
        const existing = jobs.get(jobId) || { jobId, createdAt: cbNow };
        const updated = { ...existing, updatedAt: cbNow };

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
            updated.result = body;
            if (updated.steps) {
                updated.steps = updated.steps.map(s => ({ ...s, status: 'completed', updatedAt: cbNow }));
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


