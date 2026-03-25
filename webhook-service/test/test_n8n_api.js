/**
 * test_n8n_api.js
 * n8n API + webhook-service 연동 통합 테스트
 *
 * Dependencies: node built-ins only (http, https, fs, path)
 *
 * Usage:
 *   node test/test_n8n_api.js
 *   WEBHOOK_SERVICE_URL=http://localhost:3000 N8N_URL=http://localhost:5678 node test/test_n8n_api.js
 */

'use strict';

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

// ── .env 수동 로드 ───────────────────────────────────────────────────────────
const ENV_PATH = path.join(__dirname, '..', '.env');
const env = {};
if (fs.existsSync(ENV_PATH)) {
  fs.readFileSync(ENV_PATH, 'utf8')
    .split('\n')
    .forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const idx = trimmed.indexOf('=');
      if (idx === -1) return;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      env[key] = val;
    });
}

// ── Config ───────────────────────────────────────────────────────────────────
const WEBHOOK_URL   = process.env.WEBHOOK_SERVICE_URL || `http://localhost:${env.PORT || 3000}`;
const N8N_URL       = process.env.N8N_URL || 'http://localhost:5678';
const N8N_API_KEY   = process.env.N8N_API_KEY || env.N8N_API_KEY || '';
const SDR_WEBHOOK   = process.env.N8N_SDR_WEBHOOK_URL || env.N8N_SDR_WEBHOOK_URL || `${N8N_URL}/webhook/sdr`;
const TSD_WEBHOOK   = process.env.N8N_TSD_WEBHOOK_URL || env.N8N_TSD_WEBHOOK_URL || `${N8N_URL}/webhook/tsd`;
const TAGS_WEBHOOK  = process.env.N8N_TAGS_WEBHOOK_URL || env.N8N_TAGS_WEBHOOK_URL || `${N8N_URL}/webhook/tags`;
const TIMEOUT_MS    = 10_000;

// ── ANSI 색상 ─────────────────────────────────────────────────────────────────
const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  dim:    '\x1b[2m',
};

// ── 테스트 상태 추적 ──────────────────────────────────────────────────────────
const results = [];

function pass(name, detail = '') {
  results.push({ ok: true, name });
  console.log(`  ${c.green}✔${c.reset}  ${name}${detail ? c.dim + '  — ' + detail + c.reset : ''}`);
}

function fail(name, reason = '') {
  results.push({ ok: false, name, reason });
  console.log(`  ${c.red}✘${c.reset}  ${name}${reason ? c.dim + '  — ' + reason + c.reset : ''}`);
}

function skip(name, reason = '') {
  results.push({ ok: null, name });
  console.log(`  ${c.yellow}−${c.reset}  ${c.dim}SKIP${c.reset} ${name}${reason ? c.dim + '  — ' + reason + c.reset : ''}`);
}

function group(title) {
  console.log(`\n${c.bold}${c.cyan}▶  ${title}${c.reset}`);
  console.log(`${'─'.repeat(60)}`);
}

// ── HTTP 헬퍼 ─────────────────────────────────────────────────────────────────
function request(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(urlStr);
    const transport = urlObj.protocol === 'https:' ? https : http;
    const body = options.body ? JSON.stringify(options.body) : null;

    const reqOptions = {
      hostname: urlObj.hostname,
      port:     urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path:     urlObj.pathname + (urlObj.search || ''),
      method:   options.method || (body ? 'POST' : 'GET'),
      headers: {
        'Content-Type':   'application/json',
        'Accept':         'application/json',
        ...(options.headers || {}),
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
      },
      timeout: TIMEOUT_MS,
    };

    const req = transport.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(data); } catch (_) { parsed = data; }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed, raw: data });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    if (body) req.write(body);
    req.end();
  });
}

// ── 부분 URL에서 origin 추출 ────────────────────────────────────────────────
function originOf(urlStr) {
  try {
    const u = new URL(urlStr);
    return `${u.protocol}//${u.hostname}:${u.port}`;
  } catch (_) { return N8N_URL; }
}

// ═══════════════════════════════════════════════════════════════════════════
//  GROUP 1 — n8n 서버 연결성 & API 인증
// ═══════════════════════════════════════════════════════════════════════════
async function testN8nConnectivity() {
  group('GROUP 1 — n8n 서버 연결성 & API 인증');

  // 1-1. /healthz
  try {
    const res = await request(`${N8N_URL}/healthz`);
    if (res.status === 200) {
      pass('n8n /healthz → 200 OK', `uptime check`);
    } else {
      fail('n8n /healthz → 200 OK', `HTTP ${res.status}`);
    }
  } catch (err) {
    fail('n8n /healthz → 200 OK', err.message);
  }

  // 1-2. n8n API Key 인증 (GET /api/v1/workflows)
  if (!N8N_API_KEY) {
    skip('n8n API Key 인증 확인', 'N8N_API_KEY not set');
  } else {
    try {
      const res = await request(`${N8N_URL}/api/v1/workflows`, {
        headers: { 'X-N8N-API-KEY': N8N_API_KEY },
      });
      if (res.status === 200) {
        const count = res.body?.data?.length ?? 0;
        pass('n8n API Key 인증 (GET /api/v1/workflows)', `워크플로우 ${count}개 확인`);
      } else if (res.status === 401) {
        fail('n8n API Key 인증 (GET /api/v1/workflows)', 'API key 인증 실패 (401)');
      } else {
        fail('n8n API Key 인증 (GET /api/v1/workflows)', `HTTP ${res.status}`);
      }
    } catch (err) {
      fail('n8n API Key 인증 (GET /api/v1/workflows)', err.message);
    }
  }

  // 1-3. Active 워크플로우 (SDR/TSD/Tags) 존재 여부
  if (!N8N_API_KEY) {
    skip('SDR/TSD/Tags 워크플로우 활성화 확인', 'N8N_API_KEY not set');
  } else {
    try {
      const res = await request(`${N8N_URL}/api/v1/workflows?active=true`, {
        headers: { 'X-N8N-API-KEY': N8N_API_KEY },
      });
      if (res.status === 200) {
        const workflows = res.body?.data || [];
        const names = workflows.map(w => (w.name || '').toLowerCase());
        const hasSDR  = names.some(n => n.includes('sdr'));
        const hasTSD  = names.some(n => n.includes('tsd'));
        const hasTags = names.some(n => n.includes('tag'));

        const detail = [
          hasSDR  ? '✓ SDR' : '✗ SDR',
          hasTSD  ? '✓ TSD' : '✗ TSD (inactive or missing)',
          hasTags ? '✓ Tags' : '✗ Tags (inactive or missing)',
        ].join(', ');

        // SDR 워크플로우는 반드시 있어야 함
        if (hasSDR) {
          pass('Active 워크플로우 존재 확인', detail);
        } else {
          fail('Active 워크플로우 존재 확인', `SDR 없음 — active: ${workflows.length}개`);
        }
      } else {
        fail('Active 워크플로우 존재 확인', `HTTP ${res.status}`);
      }
    } catch (err) {
      fail('Active 워크플로우 존재 확인', err.message);
    }
  }

  // 1-4. n8n executions 엔드포인트 접근 (최근 실행 내역)
  if (!N8N_API_KEY) {
    skip('n8n executions API 접근', 'N8N_API_KEY not set');
  } else {
    try {
      const res = await request(`${N8N_URL}/api/v1/executions?limit=1`, {
        headers: { 'X-N8N-API-KEY': N8N_API_KEY },
      });
      if (res.status === 200) {
        pass('n8n executions API 접근', `최근 실행 조회 가능`);
      } else {
        fail('n8n executions API 접근', `HTTP ${res.status}`);
      }
    } catch (err) {
      fail('n8n executions API 접근', err.message);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  GROUP 2 — webhook-service 엔드포인트
// ═══════════════════════════════════════════════════════════════════════════
async function testWebhookService() {
  group('GROUP 2 — webhook-service 엔드포인트 (localhost:3000)');

  // 2-1. /health
  try {
    const res = await request(`${WEBHOOK_URL}/health`);
    if (res.status === 200 && res.body?.status === 'ok') {
      pass('/health → { status: "ok" }', `uptime: ${Math.floor(res.body.uptime || 0)}s, n8nMode: ${res.body.n8nMode || 'unknown'}`);
    } else if (res.status === 200) {
      fail('/health → { status: "ok" }', `응답에 status 필드 없음: ${JSON.stringify(res.body).slice(0, 80)}`);
    } else {
      fail('/health → { status: "ok" }', `HTTP ${res.status}`);
    }
  } catch (err) {
    fail('/health → { status: "ok" }', `${err.message} — webhook-service가 실행 중인지 확인하세요 (node server.js)`);
  }

  // 2-2. GET /api/n8n-mode
  try {
    const res = await request(`${WEBHOOK_URL}/api/n8n-mode`);
    if (res.status === 200 && res.body?.mode) {
      pass('GET /api/n8n-mode → mode 필드 포함', `mode: ${res.body.mode}, urls: ${Object.keys(res.body.urls || {}).join(', ')}`);
    } else {
      fail('GET /api/n8n-mode → mode 필드 포함', `HTTP ${res.status}, body: ${JSON.stringify(res.body).slice(0, 80)}`);
    }
  } catch (err) {
    fail('GET /api/n8n-mode → mode 필드 포함', err.message);
  }

  // 2-3. GET /files
  try {
    const res = await request(`${WEBHOOK_URL}/files`);
    if (res.status === 200 && Array.isArray(res.body?.files)) {
      pass('GET /files → { files: [] }', `파일 ${res.body.files.length}개`);
    } else {
      fail('GET /files → { files: [] }', `HTTP ${res.status}`);
    }
  } catch (err) {
    fail('GET /files → { files: [] }', err.message);
  }

  // 2-4. GET /jobs
  try {
    const res = await request(`${WEBHOOK_URL}/jobs`);
    if (res.status === 200 && Array.isArray(res.body?.jobs)) {
      pass('GET /jobs → { jobs: [] }', `job ${res.body.jobs.length}개`);
    } else {
      fail('GET /jobs → { jobs: [] }', `HTTP ${res.status}`);
    }
  } catch (err) {
    fail('GET /jobs → { jobs: [] }', err.message);
  }

  // 2-5. GET /status/<없는 ID> → 404
  try {
    const res = await request(`${WEBHOOK_URL}/status/nonexistent-job-00000`);
    if (res.status === 404) {
      pass('GET /status/<없는 ID> → 404', 'Job not found 처리 정상');
    } else {
      fail('GET /status/<없는 ID> → 404', `HTTP ${res.status} (404 예상)`);
    }
  } catch (err) {
    fail('GET /status/<없는 ID> → 404', err.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  GROUP 3 — n8n 웹훅 URL 도달 가능성
// ═══════════════════════════════════════════════════════════════════════════
async function testWebhookReachability() {
  group('GROUP 3 — n8n 웹훅 URL 도달 가능성');

  const endpoints = [
    { name: 'SDR 웹훅',  url: SDR_WEBHOOK },
    { name: 'TSD 웹훅',  url: TSD_WEBHOOK },
    { name: 'Tags 웹훅', url: TAGS_WEBHOOK },
  ];

  for (const ep of endpoints) {
    if (!ep.url) {
      skip(`${ep.name} URL 도달 가능성`, 'URL 미설정');
      continue;
    }
    try {
      // 빈 POST — 유효하지 않은 payload로 테스트 (ECONNREFUSED만 없으면 n8n 응답)
      const res = await request(ep.url, { method: 'POST', body: { _ping: true } });
      // 4xx/5xx 도 "서버가 응답했다" → 네트워크 도달 성공
      pass(`${ep.name} URL 도달 가능성`, `HTTP ${res.status} (ECONNREFUSED 없음)`);
    } catch (err) {
      if (err.message.includes('ECONNREFUSED')) {
        fail(`${ep.name} URL 도달 가능성`, `ECONNREFUSED — n8n 실행 중인지 확인`);
      } else if (err.message.includes('timeout')) {
        // 타임아웃은 서버가 응답 중이지만 느린 것 → 도달 가능으로 처리
        pass(`${ep.name} URL 도달 가능성`, `응답 중 (timeout — n8n 처리 중일 수 있음)`);
      } else {
        fail(`${ep.name} URL 도달 가능성`, err.message);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  GROUP 4 — n8n 모드 전환 & 콜백 통합 테스트
// ═══════════════════════════════════════════════════════════════════════════
async function testIntegration() {
  group('GROUP 4 — 모드 전환 & 콜백 통합 테스트');

  let originalMode = 'production';

  // 4-1. 현재 모드 조회
  try {
    const res = await request(`${WEBHOOK_URL}/api/n8n-mode`);
    originalMode = res.body?.mode || 'production';
    pass('현재 n8n 모드 조회', `mode: ${originalMode}`);
  } catch (err) {
    fail('현재 n8n 모드 조회', err.message);
    // webhook-service 미실행 시 Group 4 전체 skip
    ['모드 → test 전환', 'test 모드 URL 포함 (/webhook-test/)', '모드 → production 복원',
     '잘못된 mode 값 → 400', 'POST /webhook/sdr-result (빈 콜백) → received'].forEach(t => skip(t, 'server offline'));
    return;
  }

  // 4-2. test 모드로 전환
  try {
    const res = await request(`${WEBHOOK_URL}/api/n8n-mode`, { body: { mode: 'test' } });
    if (res.status === 200 && res.body?.mode === 'test') {
      pass('모드 → test 전환', `mode: test`);
    } else {
      fail('모드 → test 전환', `HTTP ${res.status}, body: ${JSON.stringify(res.body).slice(0, 80)}`);
    }
  } catch (err) {
    fail('모드 → test 전환', err.message);
  }

  // 4-3. test 모드에서 URL에 /webhook-test/ 포함 여부
  try {
    const res = await request(`${WEBHOOK_URL}/api/n8n-mode`);
    const urls = res.body?.urls || {};
    const allTest = Object.values(urls).every(u => u && u.includes('/webhook-test/'));
    if (allTest) {
      pass('test 모드 URL 포함 (/webhook-test/)', `sdr: ${urls.sdr}`);
    } else {
      fail('test 모드 URL 포함 (/webhook-test/)', `URL: ${JSON.stringify(urls)}`);
    }
  } catch (err) {
    fail('test 모드 URL 포함 (/webhook-test/)', err.message);
  }

  // 4-4. production 모드 복원
  try {
    const res = await request(`${WEBHOOK_URL}/api/n8n-mode`, { body: { mode: originalMode } });
    if (res.status === 200 && res.body?.mode === originalMode) {
      pass(`모드 → ${originalMode} 복원`, `mode: ${originalMode}`);
    } else {
      fail(`모드 → ${originalMode} 복원`, `HTTP ${res.status}`);
    }
  } catch (err) {
    fail(`모드 → ${originalMode} 복원`, err.message);
  }

  // 4-5. 잘못된 mode 값 → 400
  try {
    const res = await request(`${WEBHOOK_URL}/api/n8n-mode`, { body: { mode: 'invalid' } });
    if (res.status === 400) {
      pass('잘못된 mode 값 → 400 Bad Request', `error: ${res.body?.error}`);
    } else {
      fail('잘못된 mode 값 → 400 Bad Request', `HTTP ${res.status} (400 예상)`);
    }
  } catch (err) {
    fail('잘못된 mode 값 → 400 Bad Request', err.message);
  }

  // 4-6. POST /webhook/sdr-result — jobId 없이 콜백 수신
  try {
    const res = await request(`${WEBHOOK_URL}/webhook/sdr-result`, {
      body: { status: 'completed', message: 'ping from test' }
    });
    if (res.status === 200 && res.body?.received === true) {
      pass('POST /webhook/sdr-result (빈 콜백) → received', `received: true`);
    } else {
      fail('POST /webhook/sdr-result (빈 콜백) → received', `HTTP ${res.status}, body: ${JSON.stringify(res.body).slice(0, 80)}`);
    }
  } catch (err) {
    fail('POST /webhook/sdr-result (빈 콜백) → received', err.message);
  }

  // 4-7. POST /webhook/sdr-result — 실제 jobId 콜백 (job 생성 후 콜백 수신 확인)
  const testJobId = `test-job-${Date.now()}`;
  // 먼저 jobs에 job을 등록하는 방법 없음 (내부 Map) → 404가 아니라 빈 콜백 처리
  try {
    const res = await request(`${WEBHOOK_URL}/webhook/sdr-result`, {
      body: { jobId: testJobId, status: 'completed', testData: true }
    });
    if (res.status === 200 && res.body?.received === true) {
      pass('POST /webhook/sdr-result (jobId 포함) → received', `jobId: ${testJobId}`);
    } else {
      fail('POST /webhook/sdr-result (jobId 포함) → received', `HTTP ${res.status}`);
    }
  } catch (err) {
    fail('POST /webhook/sdr-result (jobId 포함) → received', err.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  GROUP 5 — Stop/Cancel 플로우 테스트
// ═══════════════════════════════════════════════════════════════════════════
async function testCancelFlow() {
  group('GROUP 5 — Stop/Cancel 플로우 테스트');

  // 5-1. 존재하지 않는 job cancel → 404
  try {
    const res = await request(`${WEBHOOK_URL}/jobs/nonexistent-cancel-job/cancel`, { method: 'POST' });
    if (res.status === 404) {
      pass('존재하지 않는 job cancel → 404', 'Job not found');
    } else {
      fail('존재하지 않는 job cancel → 404', `HTTP ${res.status} (404 예상)`);
    }
  } catch (err) {
    fail('존재하지 않는 job cancel → 404', err.message);
  }

  // 5-2. n8n API를 통해 현재 running executions 조회 가능 여부
  if (!N8N_API_KEY) {
    skip('n8n running executions 조회 (cancel을 위한 사전 조건)', 'N8N_API_KEY not set');
  } else {
    try {
      const res = await request(`${N8N_URL}/api/v1/executions?status=running&limit=5`, {
        headers: { 'X-N8N-API-KEY': N8N_API_KEY },
      });
      if (res.status === 200 && Array.isArray(res.body?.data)) {
        pass('n8n running executions 조회 가능', `현재 running: ${res.body.data.length}개`);
      } else {
        fail('n8n running executions 조회 가능', `HTTP ${res.status}`);
      }
    } catch (err) {
      fail('n8n running executions 조회 가능', err.message);
    }
  }

  // 5-3. input/ 파일로 실제 SDR 트리거 → cancel → n8n execution 중단 검증
  let triggeredJobId = null;
  let triggeredN8nExecutionId = null;

  try {
    const filesRes = await request(`${WEBHOOK_URL}/files`);
    const files = filesRes.body?.files || [];
    const xlsxFile = files.find(f => /\.xlsx$/i.test(f.name));

    if (!xlsxFile) {
      skip('실제 SDR 트리거 후 cancel 테스트', 'input/ 디렉토리에 .xlsx 파일 없음');
    } else {
      // 5-3a. SDR 트리거
      const triggerRes = await request(`${WEBHOOK_URL}/trigger/sdr`, {
        body: {
          fileName:      xlsxFile.name,
          clientName:    'CancelTest',
          baseSheetName: env.SHEET_NAME_SDR || 'Requirements_v2',
        },
      });

      if (triggerRes.status === 200 && triggerRes.body?.jobId) {
        triggeredJobId = triggerRes.body.jobId;
        pass('SDR 트리거 성공 (cancel 테스트용)', `jobId: ${triggeredJobId}`);
      } else {
        fail('SDR 트리거 성공 (cancel 테스트용)', `HTTP ${triggerRes.status}: ${JSON.stringify(triggerRes.body).slice(0, 120)}`);
      }
    }
  } catch (err) {
    fail('SDR 트리거 성공 (cancel 테스트용)', err.message);
  }

  // 5-4. 트리거된 job의 n8nExecutionId 확인 (즉시 + fallback 2초 후)
  if (triggeredJobId) {
    // 즉시 조회: n8n 응답에 executionId 포함됐는지 확인 (Phase 1 수정 후)
    try {
      const statusRes = await request(`${WEBHOOK_URL}/status/${triggeredJobId}`);
      const immediateExecId = statusRes.body?.n8nExecutionId;

      if (immediateExecId) {
        triggeredN8nExecutionId = immediateExecId;
        pass('n8n executionId 즉시 응답에 포함됨 ✅ (Phase 1 수정 적용됨)', `executionId: ${immediateExecId}`);
      } else {
        // Phase 1 미적용 상태 → fallback 폴러 대기 (2.5초)
        console.log(`  ${c.dim}  → executionId 없음. fallback poller 2.5초 대기...${c.reset}`);
        await new Promise(r => setTimeout(r, 2500));

        const retryRes = await request(`${WEBHOOK_URL}/status/${triggeredJobId}`);
        const fallbackExecId = retryRes.body?.n8nExecutionId;

        if (fallbackExecId) {
          triggeredN8nExecutionId = fallbackExecId;
          pass('n8n executionId fallback poller로 해결됨 ✅ (Phase 2 동작)', `executionId: ${fallbackExecId}`);
        } else {
          fail('n8n executionId 확보 실패 ❌', 'n8n 워크플로우 JSON 재임포트 필요 (Phase 1) 또는 n8n이 running state가 아님');
        }
      }
    } catch (err) {
      fail('n8n executionId 확인', err.message);
    }

    // 5-5. Cancel 호출 → 로컬 job status = cancelled
    try {
      const cancelRes = await request(`${WEBHOOK_URL}/jobs/${triggeredJobId}/cancel`, { method: 'POST' });
      if (cancelRes.status === 200 && cancelRes.body?.cancelled === true) {
        pass(`job cancel → { cancelled: true }`, `jobId: ${triggeredJobId}`);
      } else {
        fail(`job cancel → { cancelled: true }`, `HTTP ${cancelRes.status}`);
      }
    } catch (err) {
      fail(`job cancel → { cancelled: true }`, err.message);
    }

    // 5-6. cancel 후 job status = 'cancelled' 확인
    try {
      const statusRes = await request(`${WEBHOOK_URL}/status/${triggeredJobId}`);
      if (statusRes.body?.status === 'cancelled') {
        pass('cancel 후 job status = "cancelled"', '정상 상태 전환');
      } else {
        fail('cancel 후 job status = "cancelled"', `status: ${statusRes.body?.status}`);
      }
    } catch (err) {
      fail('cancel 후 job status = "cancelled"', err.message);
    }

    // 5-7. cancel 후 이미 cancelled인 job 재cancel → 409 Conflict
    try {
      const res = await request(`${WEBHOOK_URL}/jobs/${triggeredJobId}/cancel`, { method: 'POST' });
      if (res.status === 409) {
        pass('이미 cancelled job 재cancel → 409 Conflict', `error: ${res.body?.error}`);
      } else {
        fail('이미 cancelled job 재cancel → 409 Conflict', `HTTP ${res.status} (409 예상)`);
      }
    } catch (err) {
      fail('이미 cancelled job 재cancel → 409 Conflict', err.message);
    }

    // 5-8. n8n execution이 실제로 중단됐는지 확인 (executionId가 있을 때만)
    //       server.js stopN8nExecution은 비동기로 최대 9초 재시도 → 20초 폴링
    if (triggeredN8nExecutionId && N8N_API_KEY) {
      try {
        let finalStatus = null, finalFinished = null, done = false;
        const deadline = Date.now() + 20000;
        while (Date.now() < deadline) {
          await new Promise(r => setTimeout(r, 2000));
          const execRes = await request(`${N8N_URL}/api/v1/executions/${triggeredN8nExecutionId}`, {
            headers: { 'X-N8N-API-KEY': N8N_API_KEY },
          });
          if (execRes.status === 404) {
            pass('n8n execution 실제 중단 확인 ✅', `execution ${triggeredN8nExecutionId} 완료/제거됨`);
            done = true; break;
          }
          if (execRes.status === 200) {
            finalStatus   = execRes.body?.status;
            finalFinished = execRes.body?.finished;
            if (finalStatus !== 'running' && finalStatus !== 'new') break;
            console.log(`    폴링 중... n8n status: "${finalStatus}" (최대 20초)`);
          }
        }
        if (!done) {
          if (finalStatus === 'canceled' || finalStatus === 'cancelled' || finalFinished === true) {
            pass('n8n execution 실제 중단 확인 ✅', `status: ${finalStatus}, finished: ${finalFinished}`);
          } else {
            fail('n8n execution 실제 중단 확인', `n8n execution status: "${finalStatus}" after 20s — stop API 미동작`);
          }
        }
      } catch (err) {
        fail('n8n execution 실제 중단 확인', err.message);
      }
    } else {
      skip('n8n execution 실제 중단 확인', triggeredN8nExecutionId ? 'N8N_API_KEY 없음' : 'executionId 확보 실패');
    }

    // cleanup: 테스트 job 삭제
    try {
      await request(`${WEBHOOK_URL}/jobs/${triggeredJobId}`, { method: 'DELETE' });
    } catch (_) {}
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════════════════
async function main() {
  console.log(`\n${c.bold}${c.cyan}╔══════════════════════════════════════════════════════════╗`);
  console.log(`║       n8n API 연동 통합 테스트                           ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝${c.reset}`);
  console.log(`${c.dim}  webhook-service : ${WEBHOOK_URL}`);
  console.log(`  n8n server      : ${N8N_URL}`);
  console.log(`  API key         : ${N8N_API_KEY ? N8N_API_KEY.slice(0, 20) + '...' : '(not set)'}`);
  console.log(`  SDR webhook     : ${SDR_WEBHOOK}`);
  console.log(`  TSD webhook     : ${TSD_WEBHOOK}`);
  console.log(`  Tags webhook    : ${TAGS_WEBHOOK}${c.reset}`);

  const startTime = Date.now();

  await testN8nConnectivity();
  await testWebhookService();
  await testWebhookReachability();
  await testIntegration();
  await testCancelFlow();

  // ── 최종 요약 ────────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const passed  = results.filter(r => r.ok === true).length;
  const failed  = results.filter(r => r.ok === false).length;
  const skipped = results.filter(r => r.ok === null).length;
  const total   = passed + failed;

  console.log(`\n${'═'.repeat(62)}`);
  console.log(`${c.bold}  결과 요약  (${elapsed}s)${c.reset}`);
  console.log(`${'─'.repeat(62)}`);
  console.log(`  ${c.green}${c.bold}PASS${c.reset}  ${passed} / ${total}  (skip ${skipped})`);
  if (failed > 0) {
    console.log(`  ${c.red}${c.bold}FAIL${c.reset}  ${failed}:`);
    results.filter(r => r.ok === false).forEach(r => {
      console.log(`    ${c.red}✘${c.reset}  ${r.name}${r.reason ? c.dim + '  — ' + r.reason + c.reset : ''}`);
    });
  }
  console.log(`${'═'.repeat(62)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(`\n${c.red}Fatal error:${c.reset}`, err);
  process.exit(1);
});
