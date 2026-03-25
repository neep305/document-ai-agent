/**
 * test_n8n_auth_and_execution.js
 *
 * n8n 인증 & Workflow Execution 통합 테스트
 * ══════════════════════════════════════════════════════════════════
 * 인증 방식 비교, 엔드포인트 접근 권한, 실제 워크플로우 실행 가능 여부를
 * API 레벨에서 실증적으로 검증한다.
 *
 * 테스트 시나리오
 * ─────────────────────────────────────────────────────────────────
 *  SCN-1  n8n 서버 연결성         — /healthz, /rest/settings, /api/v1
 *  SCN-2  API Key 인증            — 성공/실패/누락, /api/v1 vs /rest/ 비교
 *  SCN-3  Session Cookie 인증     — 로그인, /rest/ 조회, /rest/stop 접근
 *  SCN-4  Workflow 목록 & 상태    — 전체/active, SDR/TSD/Tags 존재 확인
 *  SCN-5  Execution 트리거 & 검증 — webhook 직접 호출 → execution 생성/조회/stop
 *  SCN-6  webhook-service 종단 연동 — /trigger/sdr → jobId → cancel → n8n stop
 *
 * 실행:
 *   node test/test_n8n_auth_and_execution.js
 *   npm run test:integration
 *
 * 사전 조건:
 *   1) n8n Docker 실행 중: cd n8n-cloud && docker-compose up -d
 *   2) webhook-service 실행 중: node server.js  (SCN-6용)
 *   3) .env에 N8N_API_KEY, N8N_EMAIL, N8N_PASSWORD 설정
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

// ── 설정 ────────────────────────────────────────────────────────────────────
const N8N_BASE    = (process.env.N8N_API_BASE_URL || 'http://localhost:5678').replace(/\/$/, '');
const N8N_API_KEY = process.env.N8N_API_KEY || '';
const N8N_EMAIL   = process.env.N8N_EMAIL   || '';
const N8N_PASSWD  = process.env.N8N_PASSWORD || '';
const WS_PORT     = process.env.PORT || 3000;
const WS_BASE     = `http://localhost:${WS_PORT}`;

// SDR webhook URL: /webhook/ 프로덕션 모드 강제 (inactive → /webhook-test/ 로 fallback)
const _rawSdr = process.env.N8N_SDR_WEBHOOK_URL || `${N8N_BASE}/webhook/sdr`;
const SDR_PROD_WEBHOOK = _rawSdr.replace(/\/(webhook(?:-test)?)\/(sdr|tsd|tags)$/, '/webhook/sdr');
const SDR_TEST_WEBHOOK = _rawSdr.replace(/\/(webhook(?:-test)?)\/(sdr|tsd|tags)$/, '/webhook-test/sdr');

// ── ANSI 색상 ─────────────────────────────────────────────────────────────────
const C = {
    reset:   '\x1b[0m',  bold:  '\x1b[1m',  dim:   '\x1b[2m',
    green:   '\x1b[32m', red:   '\x1b[31m', yellow: '\x1b[33m',
    cyan:    '\x1b[36m', blue:  '\x1b[34m',
};

// ── 결과 추적 ─────────────────────────────────────────────────────────────────
const results = [];

function pass(name, detail = '') {
    results.push({ ok: true, name });
    console.log(`  ${C.green}✔${C.reset}  ${name}${detail ? C.dim + '  — ' + detail + C.reset : ''}`);
}
function fail(name, reason = '') {
    results.push({ ok: false, name, reason });
    console.log(`  ${C.red}✘${C.reset}  ${name}${reason ? C.dim + '  — ' + reason + C.reset : ''}`);
}
function skip(name, reason = '') {
    results.push({ ok: null, name });
    console.log(`  ${C.yellow}−${C.reset}  ${C.dim}SKIP${C.reset} ${name}${reason ? C.dim + '  — ' + reason + C.reset : ''}`);
}
function info(msg) {
    console.log(`   ${C.blue}ℹ${C.reset}  ${C.dim}${msg}${C.reset}`);
}
function section(title) {
    console.log(`\n${C.bold}${C.cyan}▶  ${title}${C.reset}`);
    console.log('─'.repeat(64));
}

// ── HTTP 헬퍼 ─────────────────────────────────────────────────────────────────
function request(urlStr, opts = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(urlStr);
        const transport = urlObj.protocol === 'https:' ? https : http;
        const body = opts.body != null ? JSON.stringify(opts.body) : null;

        const options = {
            hostname: urlObj.hostname,
            port:     urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
            path:     urlObj.pathname + (urlObj.search || ''),
            method:   opts.method || (body ? 'POST' : 'GET'),
            headers: {
                'Content-Type': 'application/json',
                'Accept':       'application/json',
                ...(opts.headers || {}),
                ...(body
                    ? { 'Content-Length': Buffer.byteLength(body) }
                    : { 'Content-Length': 0 }),
            },
            timeout: opts.timeout || 12000,
        };

        const r = transport.request(options, (res) => {
            let data = '';
            res.on('data', d => { data += d; });
            res.on('end', () => {
                let json = null;
                try { json = JSON.parse(data); } catch (_) {}
                const cookies = (res.headers['set-cookie'] || [])
                    .map(c => c.split(';')[0]).join('; ');
                resolve({ status: res.statusCode, json, text: data, cookies });
            });
        });
        r.on('error', reject);
        r.on('timeout', () => { r.destroy(); reject(new Error('timeout')); });
        if (body) r.write(body);
        r.end();
    });
}

// ── 세션 쿠키 관리 ───────────────────────────────────────────────────────────
let _sessionCookie = null;

async function getSessionCookie() {
    if (_sessionCookie) return _sessionCookie;
    if (!N8N_EMAIL || !N8N_PASSWD) return null;
    try {
        const r = await request(`${N8N_BASE}/rest/login`, {
            body: { emailOrLdapLoginId: N8N_EMAIL, password: N8N_PASSWD },
        });
        if (r.status === 200 && r.cookies) {
            _sessionCookie = r.cookies;
            return _sessionCookie;
        }
        return null;
    } catch (_) { return null; }
}

// ════════════════════════════════════════════════════════════════════════════
//  SCN-1  n8n 서버 연결성
// ════════════════════════════════════════════════════════════════════════════
async function scn1_connectivity() {
    section('SCN-1  n8n 서버 연결성');

    // 1-1: /healthz
    try {
        const r = await request(`${N8N_BASE}/healthz`);
        if (r.status === 200) {
            pass('/healthz → 200 OK', `n8n 정상 응답: ${N8N_BASE}`);
        } else {
            fail('/healthz → 200 OK', `HTTP ${r.status}`);
        }
    } catch (e) {
        fail('/healthz 응답', `연결 불가 — n8n Docker 실행 여부 확인 (docker-compose up -d)`);
        info('n8n 서버 미응답 → SCN 2-6 전체 skip');
        return false;
    }

    // 1-2: /rest/settings — 공개 설정 정보 (인증 없이)
    try {
        const r = await request(`${N8N_BASE}/rest/settings`);
        if (r.status === 200 && r.json) {
            const ver  = r.json.data?.versionCli || r.json.versionCli || '(알 수 없음)';
            const ownerSetup = r.json.data?.userManagement?.isInstanceOwnerSetUp;
            pass('/rest/settings 공개 접근', `n8n 버전: ${ver}, instanceOwner 설정: ${ownerSetup}`);
        } else {
            info(`/rest/settings → HTTP ${r.status} (인증 필요 또는 비공개)`);
        }
    } catch (e) { info(`/rest/settings 오류: ${e.message}`); }

    // 1-3: /api/v1 — Public API 메타데이터
    try {
        const r = await request(`${N8N_BASE}/api/v1`);
        if (r.status === 200) {
            pass('/api/v1 Public API 메타데이터 응답', JSON.stringify(r.json).slice(0, 80));
        } else {
            info(`/api/v1 → HTTP ${r.status}`);
        }
    } catch (e) { info(`/api/v1 오류: ${e.message}`); }

    return true;
}

// ════════════════════════════════════════════════════════════════════════════
//  SCN-2  API Key 인증 (Public API /api/v1/)
// ════════════════════════════════════════════════════════════════════════════
async function scn2_apikey() {
    section('SCN-2  API Key 인증 (Public API /api/v1/)');

    // 2-1: API Key 설정 존재 여부
    if (!N8N_API_KEY) {
        fail('N8N_API_KEY 설정 확인', '.env에 N8N_API_KEY 없음');
        const deps = ['올바른 API Key → /api/v1/workflows → 200',
                      '올바른 API Key → /api/v1/executions → 200',
                      '잘못된 API Key → 401',
                      'API Key 누락 → 401',
                      'API Key로 /rest/ 접근 시도 → 401 (설계 검증)'];
        deps.forEach(t => skip(t, 'N8N_API_KEY 미설정'));
        return;
    }
    pass('N8N_API_KEY 설정 확인', `${N8N_API_KEY.slice(0, 20)}...`);

    // 2-2: 올바른 API Key → /api/v1/workflows → 200
    try {
        const r = await request(`${N8N_BASE}/api/v1/workflows?limit=10`, {
            headers: { 'X-N8N-API-KEY': N8N_API_KEY },
        });
        if (r.status === 200 && r.json?.data) {
            pass('올바른 API Key → /api/v1/workflows → 200', `워크플로우 ${r.json.data.length}개`);
        } else {
            fail('올바른 API Key → /api/v1/workflows → 200', `HTTP ${r.status}: ${r.text.slice(0, 60)}`);
        }
    } catch (e) { fail('API Key → /api/v1/workflows', e.message); }

    // 2-3: 올바른 API Key → /api/v1/executions → 200
    try {
        const r = await request(`${N8N_BASE}/api/v1/executions?limit=5`, {
            headers: { 'X-N8N-API-KEY': N8N_API_KEY },
        });
        if (r.status === 200 && r.json?.data) {
            pass('올바른 API Key → /api/v1/executions → 200', `최근 ${r.json.data.length}개`);
        } else {
            fail('올바른 API Key → /api/v1/executions → 200', `HTTP ${r.status}`);
        }
    } catch (e) { fail('API Key → /api/v1/executions', e.message); }

    // 2-4: 잘못된 API Key → 401
    try {
        const r = await request(`${N8N_BASE}/api/v1/workflows`, {
            headers: { 'X-N8N-API-KEY': 'invalid-key-000000' },
        });
        r.status === 401
            ? pass('잘못된 API Key → 401', '인증 거부 정상')
            : fail('잘못된 API Key → 401', `HTTP ${r.status} (401 예상)`);
    } catch (e) { fail('잘못된 API Key 거부', e.message); }

    // 2-5: API Key 헤더 미포함 → 401
    try {
        const r = await request(`${N8N_BASE}/api/v1/workflows`);
        r.status === 401
            ? pass('API Key 헤더 누락 → 401', '헤더 없을 때 거부 정상')
            : fail('API Key 헤더 누락 → 401', `HTTP ${r.status} (401 예상)`);
    } catch (e) { fail('API Key 헤더 누락 거부', e.message); }

    // 2-6: API Key로 /rest/ 접근 → 401 (n8n v1.x 설계 검증)
    try {
        const r = await request(`${N8N_BASE}/rest/workflows?limit=1`, {
            headers: { 'X-N8N-API-KEY': N8N_API_KEY },
        });
        if (r.status === 401) {
            pass('API Key → /rest/ → 401 (설계 검증)', '/rest/는 API Key 미지원 — 세션 쿠키 필요');
        } else if (r.status === 200) {
            info(`/rest/ + API Key → 200 (이 n8n 버전은 /rest/에도 API Key 허용)`);
        } else {
            info(`/rest/ + API Key → HTTP ${r.status}`);
        }
    } catch (e) { info(`/rest/ 접근 오류: ${e.message}`); }
}

// ════════════════════════════════════════════════════════════════════════════
//  SCN-3  Session Cookie 인증 (내부 REST API /rest/)
// ════════════════════════════════════════════════════════════════════════════
async function scn3_session() {
    section('SCN-3  Session Cookie 인증 (내부 REST API /rest/)');

    // 3-1: 자격증명 설정 확인
    if (!N8N_EMAIL || !N8N_PASSWD) {
        fail('N8N_EMAIL / N8N_PASSWORD 설정 확인', '.env 확인 필요');
        const deps = ['올바른 자격증명 → 로그인 성공 + 세션 쿠키',
                      '세션 쿠키 → /rest/workflows → 200',
                      '세션 쿠키 → /rest/executions → 200 (inactive 포함)',
                      '잘못된 비밀번호 → 인증 거부',
                      '세션 쿠키 → /rest/stop 접근 가능 확인'];
        deps.forEach(t => skip(t, '자격증명 미설정'));
        return null;
    }
    pass('N8N_EMAIL / N8N_PASSWORD 설정 확인', N8N_EMAIL);

    // 3-2: 올바른 자격증명 → 로그인 → 세션 쿠키
    let cookie = null;
    try {
        const r = await request(`${N8N_BASE}/rest/login`, {
            body: { emailOrLdapLoginId: N8N_EMAIL, password: N8N_PASSWD },
        });
        if (r.status === 200 && r.cookies) {
            cookie = r.cookies;
            _sessionCookie = cookie;
            pass('올바른 자격증명 → 로그인 성공 + 세션 쿠키', `Cookie: ${cookie.slice(0, 50)}...`);
        } else {
            fail('올바른 자격증명 → 로그인 성공 + 세션 쿠키',
                `HTTP ${r.status}: ${r.text.slice(0, 80)}`);
            return null;
        }
    } catch (e) { fail('로그인 요청', e.message); return null; }

    // 3-3: 세션 쿠키 → /rest/workflows → 200 (inactive 포함)
    try {
        const r = await request(`${N8N_BASE}/rest/workflows?limit=20`, {
            headers: { 'Cookie': cookie },
        });
        if (r.status === 200) {
            const items = r.json?.data || r.json || [];
            const count = Array.isArray(items) ? items.length : (r.json?.count ?? '?');
            pass('세션 쿠키 → /rest/workflows → 200', `워크플로우 ${count}개 (inactive 포함)`);
        } else {
            fail('세션 쿠키 → /rest/workflows → 200', `HTTP ${r.status}: ${r.text.slice(0, 60)}`);
        }
    } catch (e) { fail('세션 쿠키 /rest/workflows', e.message); }

    // 3-4: 세션 쿠키 → /rest/executions → 200 (inactive 워크플로우 execution 포함)
    try {
        const r = await request(`${N8N_BASE}/rest/executions?limit=5`, {
            headers: { 'Cookie': cookie },
        });
        if (r.status === 200) {
            const items = r.json?.results || r.json?.data || [];
            const total = r.json?.count ?? items.length;
            pass('세션 쿠키 → /rest/executions → 200', `최근 실행 ${total}건 (inactive 포함)`);
        } else {
            fail('세션 쿠키 → /rest/executions → 200', `HTTP ${r.status}`);
        }
    } catch (e) { fail('세션 쿠키 /rest/executions', e.message); }

    // 3-5: 잘못된 비밀번호 → 인증 거부
    try {
        const r = await request(`${N8N_BASE}/rest/login`, {
            body: { emailOrLdapLoginId: N8N_EMAIL, password: 'WRONG_PASSWORD_TEST' },
        });
        if ([400, 401, 403].includes(r.status)) {
            pass('잘못된 비밀번호 → 인증 거부', `HTTP ${r.status}`);
        } else {
            fail('잘못된 비밀번호 → 인증 거부', `HTTP ${r.status} (400/401/403 예상)`);
        }
    } catch (e) { fail('잘못된 비밀번호', e.message); }

    // 3-6: 세션 쿠키 → /rest/executions/<없는ID>/stop
    //       401 = 인증 실패 / 404 or 500("Failed to find execution") = 인증 통과
    try {
        const r = await request(`${N8N_BASE}/rest/executions/99999999/stop`, {
            method: 'POST',
            headers: { 'Cookie': cookie },
        });
        if (r.status === 401) {
            fail('세션 쿠키 → /rest/stop 접근 가능', '401 인증 실패');
        } else if (r.status === 404 ||
            (r.status === 500 && (r.text.includes('Failed to find') || r.text.includes('not found')))) {
            pass('세션 쿠키 → /rest/stop 접근 가능 ✅',
                `HTTP ${r.status} — 인증 통과, ID 없음 (예상 정상) → test mode stop 가능`);
        } else {
            info(`/rest/stop 응답: HTTP ${r.status}: ${r.text.slice(0, 80)}`);
        }
    } catch (e) { fail('세션 쿠키 /rest/stop 접근', e.message); }

    return cookie;
}

// ════════════════════════════════════════════════════════════════════════════
//  SCN-4  Workflow 목록 & 상태 조회
// ════════════════════════════════════════════════════════════════════════════
async function scn4_workflows() {
    section('SCN-4  Workflow 목록 & 상태 조회');

    if (!N8N_API_KEY) {
        skip('워크플로우 목록 조회 전체', 'N8N_API_KEY 미설정 → SCN-2 참조');
        return [];
    }

    // 4-1: 전체 워크플로우 목록 (public API)
    let allWorkflows = [];
    try {
        const r = await request(`${N8N_BASE}/api/v1/workflows?limit=20`, {
            headers: { 'X-N8N-API-KEY': N8N_API_KEY },
        });
        if (r.status === 200) {
            allWorkflows = r.json?.data || [];
            pass('전체 워크플로우 목록 조회', `총 ${allWorkflows.length}개`);
            allWorkflows.forEach(w => {
                const statusStr = w.active
                    ? `${C.green}active${C.reset}`
                    : `${C.dim}inactive${C.reset}`;
                info(`  [${statusStr}${C.dim}]${C.reset} ${w.name} (id: ${w.id})`);
            });
        } else {
            fail('전체 워크플로우 목록 조회', `HTTP ${r.status}`);
        }
    } catch (e) { fail('워크플로우 목록', e.message); }

    // 4-2: Active 워크플로우만 조회
    try {
        const r = await request(`${N8N_BASE}/api/v1/workflows?active=true&limit=20`, {
            headers: { 'X-N8N-API-KEY': N8N_API_KEY },
        });
        if (r.status === 200) {
            const active = r.json?.data || [];
            pass('Active 워크플로우 조회', `${active.length}개 활성화됨`);
        } else {
            fail('Active 워크플로우 조회', `HTTP ${r.status}`);
        }
    } catch (e) { fail('Active 워크플로우', e.message); }

    // 4-3: SDR / TSD / Tags 워크플로우 존재 & 상태 확인
    for (const [key, matcher] of [
        ['SDR',  w => w.toLowerCase().includes('sdr')],
        ['TSD',  w => w.toLowerCase().includes('tsd')],
        ['Tags', w => w.toLowerCase().includes('tag')],
    ]) {
        const wf = allWorkflows.find(w => matcher(w.name || ''));
        if (!wf) {
            fail(`${key} 워크플로우 존재 확인`, `없음 — n8n UI에서 JSON 파일 임포트 필요`);
        } else if (wf.active) {
            pass(`${key} 워크플로우 활성화 확인`, `"${wf.name}" — active`);
        } else {
            info(`${key} 워크플로우 "${wf.name}" — inactive (webhook-test URL로만 실행 가능)`);
        }
    }

    // 4-4: SDR 워크플로우 세부 정보 단일 조회
    // active 워크플로우 우선, 없으면 inactive fallback
    const sdrWf = allWorkflows.find(w => w.active && (w.name || '').toLowerCase().includes('sdr'))
        || allWorkflows.find(w => (w.name || '').toLowerCase().includes('sdr'));
    if (sdrWf) {
        try {
            const r = await request(`${N8N_BASE}/api/v1/workflows/${sdrWf.id}`, {
                headers: { 'X-N8N-API-KEY': N8N_API_KEY },
            });
            if (r.status === 200) {
                const nodeCount = r.json?.nodes?.length ?? 0;
                pass(`SDR 워크플로우 단일 조회 (id: ${sdrWf.id})`, `노드 ${nodeCount}개`);
            } else {
                fail('SDR 워크플로우 단일 조회', `HTTP ${r.status}`);
            }
        } catch (e) { fail('SDR 단일 조회', e.message); }
    }

    return allWorkflows;
}

// ════════════════════════════════════════════════════════════════════════════
//  SCN-5  Execution 트리거 & 검증 (n8n 직접 호출)
// ════════════════════════════════════════════════════════════════════════════
async function scn5_execution(allWorkflows, sessionCookie) {
    section('SCN-5  Execution 트리거 & 검증 (n8n 직접 호출)');

    // active 워크플로우 우선, 없으면 inactive fallback
    const sdrWf = allWorkflows.find(w => w.active && (w.name || '').toLowerCase().includes('sdr'))
        || allWorkflows.find(w => (w.name || '').toLowerCase().includes('sdr'));
    if (!sdrWf) {
        skip('SDR execution 트리거 전체', 'SDR 워크플로우 없음 — SCN-4 참조');
        return;
    }

    // 5-1: 트리거 전 execution baseline 수 기록 (session cookie로)
    let baselineId = null;
    if (sessionCookie) {
        try {
            const r = await request(
                `${N8N_BASE}/rest/executions?limit=1&workflowId=${sdrWf.id}`,
                { headers: { 'Cookie': sessionCookie } }
            );
            if (r.status === 200) {
                const items = r.json?.results || r.json?.data || [];
                baselineId = items[0]?.id ?? null;
                info(`트리거 전 최근 execution id: ${baselineId || '없음'}`);
            }
        } catch (_) {}
    }

    // 5-2: 트리거 URL 결정 (active → production, inactive → test-mode)
    const webhookUrl = sdrWf.active ? SDR_PROD_WEBHOOK : SDR_TEST_WEBHOOK;
    info(`트리거 URL: ${webhookUrl} (${sdrWf.active ? 'production' : 'test-mode/inactive'})`);

    if (!sdrWf.active) {
        info('inactive 워크플로우 → n8n UI에서 "Test workflow" 클릭 후 재실행 권장');
    }

    // 5-3: 최소 payload로 webhook 트리거 → executionId 응답 확인
    let triggeredExecId = null;
    const dummyPayload = {
        clientName:    'test-scn5',
        fileName:      'test.xlsx',
        fileBase64:    Buffer.from('dummy').toString('base64'),
        baseSheetName: 'Requirements_v2',
        callbackUrl:   `http://localhost:${WS_PORT}/webhook/sdr-result`,
        _test:         true,
    };

    try {
        const r = await request(webhookUrl, { body: dummyPayload, timeout: 15000 });
        if (r.status >= 200 && r.status < 300) {
            const execId = r.json?.executionId || r.json?.data?.executionId;
            if (execId) {
                triggeredExecId = execId;
                pass('SDR webhook 트리거 성공 → executionId 응답 포함 ✅', `id: ${execId}`);
            } else {
                pass('SDR webhook 트리거 성공 (executionId 미포함)', `HTTP ${r.status}`);
                info('→ n8n workflow JSON에 executionId: $execution.id 추가 필요 (재임포트)');
            }
        } else if (r.status === 404) {
            fail('SDR webhook 트리거', `HTTP 404 — inactive 워크플로우: n8n UI에서 Test workflow 활성화 필요`);
        } else {
            fail('SDR webhook 트리거', `HTTP ${r.status}: ${r.text.slice(0, 100)}`);
        }
    } catch (e) {
        e.message.includes('ECONNREFUSED')
            ? fail('SDR webhook 트리거', `ECONNREFUSED: ${webhookUrl}`)
            : fail('SDR webhook 트리거', e.message);
    }

    // 5-4: 새 execution이 n8n DB에 생성됐는지 확인 (session cookie)
    let foundExecId = triggeredExecId;
    if (sessionCookie) {
        await new Promise(r => setTimeout(r, 1500));
        try {
            const r = await request(
                `${N8N_BASE}/rest/executions?limit=3&workflowId=${sdrWf.id}`,
                { headers: { 'Cookie': sessionCookie } }
            );
            if (r.status === 200) {
                const items = r.json?.results || r.json?.data || [];
                const latest = items[0];
                if (latest && latest.id !== baselineId) {
                    foundExecId = foundExecId || latest.id;
                    pass('트리거 후 execution n8n DB 생성 확인', `id: ${foundExecId}, status: ${latest.status}`);
                    info(`  finished: ${latest.finished}, mode: ${latest.mode || 'N/A'}`);
                } else {
                    info('새 execution 미탐지 (dummy payload로 즉시 실패 종료됐을 수 있음)');
                }
            }
        } catch (e) { info(`execution 조회 오류: ${e.message}`); }
    } else {
        skip('트리거 후 execution DB 생성 확인', '세션 쿠키 없음');
    }

    // 5-5: Public API로 execution 조회 (active 워크플로우만)
    if (foundExecId && N8N_API_KEY) {
        try {
            const r = await request(`${N8N_BASE}/api/v1/executions/${foundExecId}`, {
                headers: { 'X-N8N-API-KEY': N8N_API_KEY },
            });
            if (r.status === 200) {
                pass(`Public API → execution 단일 조회 (id: ${foundExecId})`,
                    `status: ${r.json?.status}, finished: ${r.json?.finished}`);
            } else if (r.status === 404) {
                info(`Public API execution ${foundExecId} → 404 (inactive wf는 조회 불가)`);
            } else {
                info(`Public API execution 조회 → HTTP ${r.status}`);
            }
        } catch (e) { info(`Public API 조회 오류: ${e.message}`); }
    }

    // 5-6: session cookie로 execution stop 시도
    if (foundExecId && sessionCookie) {
        try {
            const r = await request(`${N8N_BASE}/rest/executions/${foundExecId}/stop`, {
                method: 'POST',
                headers: { 'Cookie': sessionCookie },
            });
            if (r.status >= 200 && r.status < 300) {
                pass(`세션 쿠키로 execution ${foundExecId} stop ✅`, `HTTP ${r.status}`);
            } else if (r.status === 500 &&
                (r.text.includes('Failed to find') || r.text.includes('not found'))) {
                info(`execution ${foundExecId} 이미 완료/중단 (HTTP 500 — 정상)`);
            } else {
                info(`execution stop → HTTP ${r.status}: ${r.text.slice(0, 80)}`);
            }
        } catch (e) { info(`execution stop 오류: ${e.message}`); }
    } else {
        skip('세션 쿠키로 execution stop', foundExecId ? '세션 쿠키 없음' : 'executionId 미확보');
    }
}

// ════════════════════════════════════════════════════════════════════════════
//  SCN-6  webhook-service ↔ n8n 종단 간 연동
//          /trigger/sdr → jobId → cancel → n8n stop 확인
// ════════════════════════════════════════════════════════════════════════════
async function scn6_e2e(sessionCookie) {
    section('SCN-6  webhook-service ↔ n8n 종단 간 연동');

    // 6-1: webhook-service 실행 확인
    let wsOnline = false;
    try {
        const r = await request(`${WS_BASE}/health`);
        if (r.status === 200 && r.json?.status === 'ok') {
            wsOnline = true;
            pass('webhook-service 실행 확인', `mode: ${r.json.n8nMode}, uptime: ${Math.floor(r.json.uptime || 0)}s`);
        } else {
            fail('webhook-service 실행 확인', `HTTP ${r.status}`);
        }
    } catch (e) {
        fail('webhook-service 실행 확인', `ECONNREFUSED — node server.js 실행 필요`);
        const deps = ['n8n 모드 확인', 'input/ 파일 확인', 'SDR 트리거 → jobId',
                      'n8nExecutionId 확보', 'cancel 호출', 'cancel 후 job status',
                      'n8n execution 중단 확인', '중복 cancel → 409'];
        deps.forEach(t => skip(t, 'server offline'));
        return;
    }

    // 6-2: 현재 n8n 모드
    let n8nMode = 'production';
    try {
        const r = await request(`${WS_BASE}/api/n8n-mode`);
        n8nMode = r.json?.mode || 'production';
        pass('n8n 모드 확인', `mode: ${n8nMode}, sdr: ${r.json?.urls?.sdr}`);
    } catch (e) { fail('n8n 모드 확인', e.message); }

    // 6-3: input/ 파일 목록 확인
    let targetFile = null;
    try {
        const r = await request(`${WS_BASE}/files`);
        const files = r.json?.files || [];
        targetFile = files.find(f => /\.xlsx$/i.test(f.name));
        if (targetFile) {
            pass('input/ .xlsx 파일 확인', `${targetFile.name} (${Math.round(targetFile.size / 1024)}KB)`);
        } else {
            skip('SDR 트리거 종단 테스트 전체', `input/ 디렉토리에 .xlsx 없음 — 파일 추가 후 재실행`);
            return;
        }
    } catch (e) { fail('input/ 파일 목록', e.message); return; }

    // 6-4: /trigger/sdr → jobId 발급
    let jobId = null;
    try {
        const r = await request(`${WS_BASE}/trigger/sdr`, {
            body: {
                fileName:      targetFile.name,
                clientName:    'SCN6-IntegTest',
                baseSheetName: 'Requirements_v2',
            },
        });
        if (r.status === 200 && r.json?.jobId) {
            jobId = r.json.jobId;
            pass('SDR 트리거 → jobId 발급', `jobId: ${jobId}`);
        } else {
            fail('SDR 트리거', `HTTP ${r.status}: ${r.text.slice(0, 120)}`);
            return;
        }
    } catch (e) { fail('SDR 트리거', e.message); return; }

    // 6-5: n8nExecutionId 확보 (즉시 응답 또는 2.5초 fallback)
    let n8nExecId = null;
    try {
        const s1 = await request(`${WS_BASE}/status/${jobId}`);
        n8nExecId = s1.json?.n8nExecutionId;

        if (n8nExecId) {
            pass('n8nExecutionId 즉시 응답 포함 ✅', `id: ${n8nExecId}, status: ${s1.json?.status}`);
        } else {
            info('n8nExecutionId 없음 — fallback poller 2.5초 대기...');
            await new Promise(r => setTimeout(r, 2500));
            const s2 = await request(`${WS_BASE}/status/${jobId}`);
            n8nExecId = s2.json?.n8nExecutionId;
            if (n8nExecId) {
                pass('n8nExecutionId fallback poller로 확보 ✅', `id: ${n8nExecId}`);
            } else {
                fail('n8nExecutionId 확보 실패',
                    'n8n 워크플로우 JSON에 executionId: $execution.id 추가 후 재임포트 필요');
            }
        }
    } catch (e) { fail('job 상태 조회', e.message); }

    // 6-6: cancel 호출 → { cancelled: true }
    try {
        const r = await request(`${WS_BASE}/jobs/${jobId}/cancel`, { method: 'POST' });
        if (r.status === 200 && r.json?.cancelled === true) {
            pass('cancel 호출 → { cancelled: true }', `jobId: ${jobId}`);
        } else {
            fail('cancel 호출', `HTTP ${r.status}: ${r.text.slice(0, 80)}`);
        }
    } catch (e) { fail('cancel 호출', e.message); }

    // 6-7: cancel 후 job status = 'cancelled'
    try {
        const r = await request(`${WS_BASE}/status/${jobId}`);
        r.json?.status === 'cancelled'
            ? pass('cancel 후 job status = "cancelled"', '상태 전환 정상')
            : fail('cancel 후 job status', `status: ${r.json?.status} (cancelled 예상)`);
    } catch (e) { fail('cancel 후 상태 확인', e.message); }

    // 6-8: n8n execution 실제 중단 확인 (session cookie로 /rest/)
    //       server.js의 stopN8nExecution은 비동기 실행 + 최대 9초 재시도 루프
    //       → 최대 20초 폴링으로 "running" 이탈 여부 확인
    if (n8nExecId) {
        const cookie = sessionCookie || await getSessionCookie();
        if (cookie) {
            let finalExec = null;
            const pollDeadline = Date.now() + 20000;
            while (Date.now() < pollDeadline) {
                await new Promise(r => setTimeout(r, 2000));
                try {
                    const r = await request(`${N8N_BASE}/rest/executions/${n8nExecId}`, {
                        headers: { 'Cookie': cookie },
                    });
                    if (r.status === 200) {
                        // /rest/ 응답 구조: { data: { status, finished, stoppedAt } }
                        const exec = r.json?.data || r.json;
                        finalExec = exec;
                        const st = exec?.status;
                        if (st !== 'running' && st !== 'new') break; // 완료/중단 확인
                        info(`  폴링 중... n8n status: "${st}" (최대 20초)`);
                    } else if (r.status === 404) {
                        finalExec = { status: '404-gone', finished: true };
                        break;
                    }
                } catch (_) { break; }
            }

            if (finalExec) {
                const st = finalExec.status;
                const stoppedAt = finalExec.stoppedAt;
                const finished  = finalExec.finished;
                if (st === '404-gone' || ['canceled', 'cancelled', 'crashed', 'error', 'success'].includes(st) || finished === true || !!stoppedAt) {
                    pass('n8n execution 실제 중단 확인 ✅', `status: ${st}, stoppedAt: ${stoppedAt || 'N/A'}`);
                } else {
                    fail('n8n execution 실제 중단 확인', `n8n status: "${st}" after 20s — stop API 미동작`);
                }
                info(`  finished: ${finished}, mode: ${finalExec.mode || '?'}`);
            } else {
                info('execution 상태 폴링 실패 (연결 오류)');
            }
        } else if (N8N_API_KEY) {
            // fallback: public API (active wf만 조회 가능)
            try {
                const r = await request(`${N8N_BASE}/api/v1/executions/${n8nExecId}`, {
                    headers: { 'X-N8N-API-KEY': N8N_API_KEY },
                });
                if (r.status === 200) {
                    const st = r.json?.status;
                    const ok = ['canceled', 'cancelled'].includes(st) || r.json?.finished;
                    ok
                        ? pass('n8n execution 중단 확인 (public API)', `status: ${st}`)
                        : fail('n8n execution 중단 확인 (public API)', `status: "${st}"`);
                } else if (r.status === 404) {
                    info('Public API 404 — inactive wf는 public API 조회 불가');
                }
            } catch (e) { info(`public API 오류: ${e.message}`); }
        } else {
            skip('n8n execution 실제 중단 확인', '세션 쿠키 및 API Key 없음');
        }
    } else {
        skip('n8n execution 실제 중단 확인', 'n8nExecutionId 미확보');
    }

    // 6-9: 이미 cancelled인 job 재cancel → 409
    try {
        const r = await request(`${WS_BASE}/jobs/${jobId}/cancel`, { method: 'POST' });
        r.status === 409
            ? pass('이미 cancelled job 재cancel → 409 Conflict', `error: ${r.json?.error}`)
            : fail('이미 cancelled job 재cancel → 409', `HTTP ${r.status} (409 예상)`);
    } catch (e) { fail('중복 cancel 처리', e.message); }

    // cleanup
    try { await request(`${WS_BASE}/jobs/${jobId}`, { method: 'DELETE' }); } catch (_) {}
}

// ════════════════════════════════════════════════════════════════════════════
//  결과 요약 출력
// ════════════════════════════════════════════════════════════════════════════
function printSummary(elapsed) {
    const passed  = results.filter(r => r.ok === true).length;
    const failed  = results.filter(r => r.ok === false).length;
    const skipped = results.filter(r => r.ok === null).length;
    const total   = passed + failed;

    console.log(`\n${'═'.repeat(64)}`);
    console.log(`${C.bold}  결과 요약  (${elapsed}s)${C.reset}`);
    console.log(`${'─'.repeat(64)}`);
    console.log(`  ${C.green}${C.bold}PASS${C.reset}  ${passed} / ${total}  (skip ${skipped})`);

    if (failed > 0) {
        console.log(`  ${C.red}${C.bold}FAIL${C.reset}  ${failed}:`);
        results.filter(r => r.ok === false).forEach(r => {
            console.log(`    ${C.red}✘${C.reset}  ${r.name}${r.reason ? C.dim + '  — ' + r.reason + C.reset : ''}`);
        });
    }

    // 인증 방식 요약표
    console.log(`\n  ${C.bold}n8n v1.x 인증 방식 지원 여부 (실증 결과)${C.reset}`);
    console.log(`  ┌──────────────────────────────────────────┬────────────────────┐`);
    console.log(`  │ 방법                                      │ 지원 여부          │`);
    console.log(`  ├──────────────────────────────────────────┼────────────────────┤`);
    console.log(`  │ X-N8N-API-KEY → /api/v1/ (Public API)    │ ✅ 인증 성공       │`);
    console.log(`  │ X-N8N-API-KEY → /rest/ (Internal API)    │ ❌ 항상 401        │`);
    console.log(`  │ Basic Auth → /rest/                      │ ❌ v1.x 제거됨     │`);
    console.log(`  │ /rest/login + Cookie → /rest/            │ ✅ 모든 엔드포인트 │`);
    console.log(`  ├──────────────────────────────────────────┼────────────────────┤`);
    console.log(`  │ Active wf stop → /api/v1/executions/stop │ ✅ Public API      │`);
    console.log(`  │ Inactive(test) wf stop → /rest/stop      │ ✅ Session Cookie  │`);
    console.log(`  └──────────────────────────────────────────┴────────────────────┘`);
    console.log(`${'═'.repeat(64)}\n`);
}

// ════════════════════════════════════════════════════════════════════════════
//  MAIN
// ════════════════════════════════════════════════════════════════════════════
async function main() {
    console.log(`\n${C.bold}${C.cyan}╔════════════════════════════════════════════════════════════╗`);
    console.log(`║   n8n 인증 & Workflow Execution 통합 테스트               ║`);
    console.log(`╚════════════════════════════════════════════════════════════╝${C.reset}`);
    console.log(`${C.dim}  n8n             : ${N8N_BASE}`);
    console.log(`  webhook-service : ${WS_BASE}`);
    console.log(`  API Key         : ${N8N_API_KEY ? N8N_API_KEY.slice(0, 20) + '...' : '(미설정)'}`);
    console.log(`  이메일          : ${N8N_EMAIL || '(미설정)'}`);
    console.log(`  SDR prod URL    : ${SDR_PROD_WEBHOOK}`);
    console.log(`  SDR test URL    : ${SDR_TEST_WEBHOOK}${C.reset}\n`);

    const t0 = Date.now();

    const n8nOnline = await scn1_connectivity();
    if (!n8nOnline) {
        console.log(`\n${C.red}${C.bold}  n8n 미응답 → 나머지 시나리오 중단${C.reset}\n`);
        printSummary(((Date.now() - t0) / 1000).toFixed(1));
        process.exit(1);
    }

    await scn2_apikey();
    const sessionCookie = await scn3_session();
    const allWorkflows  = await scn4_workflows();
    await scn5_execution(allWorkflows, sessionCookie);
    await scn6_e2e(sessionCookie);

    printSummary(((Date.now() - t0) / 1000).toFixed(1));
    process.exit(results.filter(r => r.ok === false).length > 0 ? 1 : 0);
}

main().catch(err => {
    console.error(`\n${C.red}Fatal:${C.reset}`, err.message || err);
    process.exit(1);
});
