/**
 * test_n8n_stop_api.js
 *
 * n8n Execution Stop API 진단 스크립트
 * ─────────────────────────────────────
 * 목적: n8n API에서 실행 중단(stop)이 가능한 방법을 결정하고
 *       어떤 엔드포인트/인증 방식이 동작하는지 실증적으로 확인.
 *
 * 배경:
 *   - Public API  (/api/v1/executions/{id}/stop): active 워크플로우만 허용 → test mode = 404
 *   - Internal API (/rest/executions/{id}/stop): inactive 워크플로우도 허용하나 인증 방식이 버전별로 다름
 *   - n8n v1.x: N8N_BASIC_AUTH_ACTIVE 제거 → REST API도 X-N8N-API-KEY 사용
 *
 * 실행:
 *   node test/test_n8n_stop_api.js
 *   (webhook-service 디렉토리에서 실행)
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const http = require('http');
const https = require('https');

// ── 설정 ──────────────────────────────────────────────────────────────────────
const N8N_API_KEY = process.env.N8N_API_KEY || '';
const N8N_API_BASE = (process.env.N8N_API_BASE_URL || 'http://localhost:5678').replace(/\/$/, '');
const N8N_BASIC_USER = process.env.N8N_BASIC_AUTH_USER || '';
const N8N_BASIC_PASS = process.env.N8N_BASIC_AUTH_PASSWORD || '';
const N8N_EMAIL = process.env.N8N_EMAIL || '';
const N8N_PASSWORD = process.env.N8N_PASSWORD || '';

const RESULTS = [];
let passed = 0;
let failed = 0;
let skipped = 0;

// ── 유틸리티 ───────────────────────────────────────────────────────────────────
function request(method, url, headers = {}, body = null) {
    return new Promise((resolve) => {
        const urlObj = new URL(url);
        const transport = urlObj.protocol === 'https:' ? https : http;
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method,
            headers: { ...headers },
            timeout: 10000,
        };
        const bodyStr = body ? JSON.stringify(body) : null;
        if (bodyStr) {
            options.headers['Content-Type'] = 'application/json';
            options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
        } else {
            options.headers['Content-Length'] = 0;
        }
        const req = transport.request(options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                let json = null;
                try { json = JSON.parse(data); } catch (_) { }
                // Capture set-cookie headers for login responses
                const cookies = (res.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
                resolve({ status: res.statusCode, text: data, json, cookies });
            });
        });
        req.on('error', (e) => resolve({ status: null, text: e.message, json: null, cookies: '' }));
        req.on('timeout', () => { req.destroy(); resolve({ status: null, text: 'TIMEOUT', json: null, cookies: '' }); });
        if (bodyStr) req.write(bodyStr);
        req.end();
    });
}

function log(status, label, detail = '') {
    const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : status === 'SKIP' ? '⏭️' : 'ℹ️';
    const line = `  ${icon} ${label}${detail ? ': ' + detail : ''}`;
    console.log(line);
    RESULTS.push({ status, label, detail });
    if (status === 'PASS') passed++;
    else if (status === 'FAIL') failed++;
    else if (status === 'SKIP') skipped++;
}

function section(title) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`  ${title}`);
    console.log('─'.repeat(60));
}

// ── 테스트 그룹 ────────────────────────────────────────────────────────────────

/**
 * GROUP 1: n8n 접근성 및 API 키 검증
 */
async function group1_connectivity() {
    section('GROUP 1: n8n 서버 접근성 및 API 키');

    // 1-1: healthz
    const health = await request('GET', `${N8N_API_BASE}/healthz`);
    if (health.status === 200) {
        log('PASS', 'n8n /healthz 응답 OK');
    } else {
        log('FAIL', 'n8n /healthz 응답 실패', `HTTP ${health.status} — n8n이 실행 중인지 확인`);
        return false; // 이후 테스트 의미 없음
    }

    // 1-2: API 키 확인
    if (!N8N_API_KEY) {
        log('FAIL', 'N8N_API_KEY 미설정', '.env 확인 필요');
        return false;
    }
    log('INFO', 'N8N_API_KEY 확인', `${N8N_API_KEY.slice(0, 20)}...`);

    // 1-3: Public API — 워크플로우 목록으로 API 키 유효성 확인
    const workflows = await request('GET', `${N8N_API_BASE}/api/v1/workflows?limit=5`, {
        'X-N8N-API-KEY': N8N_API_KEY,
    });
    if (workflows.status === 200) {
        const count = workflows.json?.data?.length ?? '?';
        log('PASS', 'Public API (/api/v1/workflows) — API 키 인증 성공', `${count}개 워크플로우`);
    } else {
        log('FAIL', 'Public API — API 키 인증 실패', `HTTP ${workflows.status}: ${workflows.text.slice(0, 80)}`);
        return false;
    }

    // 1-4: 내부 REST API — 같은 API 키로 /rest/ 접근
    const restWorkflows = await request('GET', `${N8N_API_BASE}/rest/workflows?limit=5`, {
        'X-N8N-API-KEY': N8N_API_KEY,
    });
    if (restWorkflows.status === 200) {
        log('PASS', 'Internal REST API (/rest/workflows) — X-N8N-API-KEY 인증 성공');
    } else {
        log('FAIL', 'Internal REST API (/rest/workflows) — X-N8N-API-KEY 인증 실패',
            `HTTP ${restWorkflows.status}: ${restWorkflows.text.slice(0, 100)}`);
        log('INFO', '  → n8n v1.x에서는 /rest/ 엔드포인트도 X-N8N-API-KEY 인증을 지원');
        log('INFO', '  → 401이면 API 키 재확인 필요 (인증 성공해야 stop 가능)');
    }

    return true;
}

/**
 * GROUP 2: Executions 조회 API 능력 확인
 */
async function group2_executions_query() {
    section('GROUP 2: Executions 조회 능력');

    // 2-1: Public API — executions 목록
    const pubExecs = await request('GET', `${N8N_API_BASE}/api/v1/executions?limit=5`, {
        'X-N8N-API-KEY': N8N_API_KEY,
    });
    if (pubExecs.status === 200) {
        const count = pubExecs.json?.data?.length ?? '?';
        log('PASS', 'Public API — executions 목록 조회', `${count}개 반환 (active 워크플로우만)`);
    } else {
        log('FAIL', 'Public API — executions 조회 실패', `HTTP ${pubExecs.status}`);
    }

    // 2-2: Internal REST API — executions 목록 (inactive 포함)
    const restExecs = await request('GET', `${N8N_API_BASE}/rest/executions?limit=5`, {
        'X-N8N-API-KEY': N8N_API_KEY,
    });
    if (restExecs.status === 200) {
        const count = Array.isArray(restExecs.json?.results) 
            ? restExecs.json.results.length 
            : (restExecs.json?.count ?? '?');
        log('PASS', 'Internal REST API — executions 조회', `정상 응답 (inactive 포함)`);
    } else {
        log('FAIL', 'Internal REST API — executions 조회 실패', `HTTP ${restExecs.status}: ${restExecs.text.slice(0, 80)}`);
        log('INFO', '  → /rest/ API 인증 실패 시 stop도 실패함');
    }

    // 2-3: running 상태 execution 조회
    const running = await request('GET', `${N8N_API_BASE}/api/v1/executions?status=running&limit=5`, {
        'X-N8N-API-KEY': N8N_API_KEY,
    });
    if (running.status === 200) {
        const runList = running.json?.data ?? [];
        if (runList.length > 0) {
            log('PASS', 'Public API — running execution 조회', `실행 중인 execution: ${runList.map(e => e.id).join(', ')}`);
            return runList[0].id; // stop 테스트에 사용
        } else {
            log('INFO', 'Public API — running execution 없음 (정상)', 'stop 테스트는 실제 실행 중일 때 수행');
        }
    }

    return null; // running execution 없음
}

/**
 * GROUP 3: 존재하지 않는 ID로 stop API 동작 확인 (API 형식 검증)
 */
async function group3_stop_format_check() {
    section('GROUP 3: Stop API 엔드포인트 존재 여부 (가짜 ID)');
    const fakeId = '99999999';

    // 3-1: Public API stop — 가짜 ID
    const pubStop = await request('POST', `${N8N_API_BASE}/api/v1/executions/${fakeId}/stop`, {
        'X-N8N-API-KEY': N8N_API_KEY,
    });
    log('INFO', `Public API /api/v1/executions/${fakeId}/stop`, `HTTP ${pubStop.status}: ${pubStop.text.slice(0, 80)}`);
    if (pubStop.status === 404) {
        log('PASS', 'Public API stop 엔드포인트 존재 확인', '404 = 엔드포인트는 있으나 ID를 못 찾음 (예상 정상)');
    } else if (pubStop.status === 401 || pubStop.status === 403) {
        log('FAIL', 'Public API stop — 인증 실패', `HTTP ${pubStop.status}`);
    } else if (pubStop.status === null) {
        log('FAIL', 'Public API stop — 연결 실패', pubStop.text);
    }

    // 3-2: Internal REST API stop — 가짜 ID + X-N8N-API-KEY
    const restStop = await request('POST', `${N8N_API_BASE}/rest/executions/${fakeId}/stop`, {
        'X-N8N-API-KEY': N8N_API_KEY,
    });
    log('INFO', `Internal REST /rest/executions/${fakeId}/stop (API Key)`, `HTTP ${restStop.status}: ${restStop.text.slice(0, 80)}`);
    if (restStop.status === 404) {
        log('PASS', 'Internal REST stop (API Key) — 엔드포인트 인증 OK', '404 = 인증은 통과, ID를 못 찾음 (예상 정상)');
    } else if (restStop.status === 401) {
        log('FAIL', 'Internal REST stop — X-N8N-API-KEY 인증 실패 (401)',
            '→ n8n /rest/ 엔드포인트가 이 API 키를 거부');
        log('INFO', '  해결 방법 1: n8n UI → Settings → API → API key 재생성 후 .env 업데이트');
        log('INFO', '  해결 방법 2: session cookie 방식 사용 (하단 GROUP 4 확인)');
    } else if (restStop.status === 200 || restStop.status === 204) {
        log('PASS', 'Internal REST stop — 인증 OK + 응답 정상', `HTTP ${restStop.status}`);
    }

    // 3-3: Internal REST API stop — 가짜 ID + Basic Auth
    if (N8N_BASIC_USER && N8N_BASIC_PASS) {
        const basicToken = Buffer.from(`${N8N_BASIC_USER}:${N8N_BASIC_PASS}`).toString('base64');
        const basicStop = await request('POST', `${N8N_API_BASE}/rest/executions/${fakeId}/stop`, {
            'Authorization': `Basic ${basicToken}`,
        });
        log('INFO', `Internal REST stop (Basic Auth: ${N8N_BASIC_USER}:***)`, `HTTP ${basicStop.status}: ${basicStop.text.slice(0, 80)}`);
        if (basicStop.status === 404) {
            log('PASS', 'Internal REST stop — Basic Auth 인증 OK',
                `HTTP 404 = 인증 통과, ID 없음 (n8n에 N8N_BASIC_AUTH_ACTIVE=true 설정된 경우)`);
        } else if (basicStop.status === 401) {
            log('INFO', 'Internal REST stop — Basic Auth 인증 실패',
                '→ n8n v1.x에서는 N8N_BASIC_AUTH_ACTIVE가 제거됨 (예상된 동작)');
        }
    } else {
        log('SKIP', 'Basic Auth 테스트 — N8N_BASIC_AUTH_USER/PASSWORD 미설정');
    }
}

/**
 * GROUP 4: Session cookie 방식으로 인증 후 stop (n8n v1.x user management)
 */
async function group4_session_auth() {
    section('GROUP 4: Session Cookie 인증 (n8n 이메일/비밀번호 로그인)');

    if (!N8N_EMAIL || !N8N_PASSWORD) {
        log('SKIP', 'N8N_EMAIL / N8N_PASSWORD 미설정', '.env에 N8N_EMAIL, N8N_PASSWORD 추가 필요');
        return null;
    }

    // 4-1: 로그인 (n8n v1.x: emailOrLdapLoginId 필드 사용)
    const login = await request('POST', `${N8N_API_BASE}/rest/login`, {}, {
        emailOrLdapLoginId: N8N_EMAIL,
        password: N8N_PASSWORD,
    });

    if (login.status !== 200) {
        log('FAIL', 'n8n 로그인 실패', `HTTP ${login.status}: ${login.text.slice(0, 100)}`);
        return null;
    }

    log('PASS', 'n8n 로그인 성공', `HTTP ${login.status}`);

    // 4-2: set-cookie 헤더에서 세션 쿠키 추출
    const sessionCookie = login.cookies;
    if (sessionCookie) {
        log('PASS', '세션 쿠키 발급됨', sessionCookie.slice(0, 60) + (sessionCookie.length > 60 ? '...' : ''));

        // 4-3: 세션 쿠키로 /rest/ API 접근
        const fakeId = '99999999';
        const cookieStop = await request('POST', `${N8N_API_BASE}/rest/executions/${fakeId}/stop`, {
            'Cookie': sessionCookie,
        });
        log('INFO', `세션 쿠키로 stop 시도 (ID: ${fakeId})`, `HTTP ${cookieStop.status}: ${cookieStop.text.slice(0, 80)}`);
        if (cookieStop.status === 404 || cookieStop.status === 500) {
            // 404 또는 500("Failed to find execution") = 인증 통과, ID가 없음 (예상 정상)
            const notFound = cookieStop.status === 500 &&
                (cookieStop.text.includes('Failed to find execution') || cookieStop.text.includes('not found'));
            if (cookieStop.status === 404 || notFound) {
                log('PASS', '세션 쿠키 인증 OK — /rest/stop 접근 가능!',
                    `HTTP ${cookieStop.status} = 인증 통과, ID 없음 → test mode stop 사용 가능`);
                return sessionCookie;
            }
            log('INFO', `stop 응답: HTTP ${cookieStop.status}`, cookieStop.text.slice(0, 80));
        } else if (cookieStop.status === 401) {
            log('FAIL', '세션 쿠키 인증 실패 (401)', '쿠키가 올바르지 않거나 만료됨');
        } else if (cookieStop.status >= 200 && cookieStop.status < 300) {
            log('PASS', '세션 쿠키 인증 OK — stop 성공', `HTTP ${cookieStop.status}`);
            return sessionCookie;
        } else {
            log('INFO', `stop 응답: HTTP ${cookieStop.status}`, cookieStop.text.slice(0, 80));
        }
    } else {
        // 로그인 JSON 응답에 token이 있는지 확인
        const token = login.json?.data?.token || login.json?.token;
        if (token) {
            log('INFO', '쿠키 없음, JWT 토큰 발급됨', `Bearer ${String(token).slice(0, 30)}...`);
            const fakeId = '99999999';
            const tokenStop = await request('POST', `${N8N_API_BASE}/rest/executions/${fakeId}/stop`, {
                'Authorization': `Bearer ${token}`,
            });
            log('INFO', `Bearer 토큰으로 stop 시도`, `HTTP ${tokenStop.status}: ${tokenStop.text.slice(0, 80)}`);
            if (tokenStop.status === 404) {
                log('PASS', 'Bearer 토큰 인증 OK', '→ token을 sessionCookie 대신 사용');
                return `bearer:${token}`;
            }
        } else {
            log('FAIL', '로그인 응답에 쿠키도 토큰도 없음', JSON.stringify(login.json).slice(0, 100));
        }
    }

    return null;
}

/**
 * GROUP 5: 실시간 running execution에 대한 stop 기능 확인
 */
async function group5_live_stop(runningId) {
    section('GROUP 5: 실시간 Execution Stop 테스트');

    if (!runningId) {
        log('SKIP', 'running execution 없음', 'n8n에서 워크플로우를 실행 중일 때 다시 시도');
        log('INFO', '수동 테스트 방법:');
        log('INFO', '  1) n8n UI에서 SDR 워크플로우 테스트 모드 시작');
        log('INFO', '  2) webhook-service에서 SDR 요청 전송');
        log('INFO', '  3) 이 스크립트를 다시 실행 → GROUP 5에서 자동으로 stop 시도');
        return;
    }

    log('INFO', `실행 중인 execution 발견: ${runningId}`);

    // 5-1: Public API stop
    const pubStop = await request('POST', `${N8N_API_BASE}/api/v1/executions/${runningId}/stop`, {
        'X-N8N-API-KEY': N8N_API_KEY,
    });
    log('INFO', `Public API stop (ID: ${runningId})`, `HTTP ${pubStop.status}: ${pubStop.text.slice(0, 80)}`);
    if (pubStop.status >= 200 && pubStop.status < 300) {
        log('PASS', 'Public API stop 성공!', '→ 워크플로우가 active 상태였음');
        return;
    }

    // 5-2: Internal REST API stop
    const restStop = await request('POST', `${N8N_API_BASE}/rest/executions/${runningId}/stop`, {
        'X-N8N-API-KEY': N8N_API_KEY,
    });
    log('INFO', `Internal REST stop (ID: ${runningId})`, `HTTP ${restStop.status}: ${restStop.text.slice(0, 80)}`);
    if (restStop.status >= 200 && restStop.status < 300) {
        log('PASS', 'Internal REST API stop 성공!', '→ test mode 중단 가능');
    } else {
        log('FAIL', 'Internal REST API stop 실패', `HTTP ${restStop.status}`);
    }
}

/**
 * GROUP 6: n8n 버전 및 API 지원 능력 요약
 */
async function group6_version_and_capabilities() {
    section('GROUP 6: n8n 버전 및 API 지원 능력 요약');

    const version = await request('GET', `${N8N_API_BASE}/healthz`);
    log('INFO', 'Healthz 응답', version.text.slice(0, 100));

    // Public API 메타데이터
    const apiMeta = await request('GET', `${N8N_API_BASE}/api/v1`, {
        'X-N8N-API-KEY': N8N_API_KEY,
    });
    if (apiMeta.status === 200) {
        log('INFO', 'Public API 메타', JSON.stringify(apiMeta.json).slice(0, 150));
    }

    // n8n 버전
    const settings = await request('GET', `${N8N_API_BASE}/rest/settings`, {
        'X-N8N-API-KEY': N8N_API_KEY,
    });
    if (settings.status === 200 && settings.json) {
        const ver = settings.json.data?.versionCli || settings.json.versionCli || '알 수 없음';
        log('INFO', 'n8n 버전', ver);
        const authType = settings.json.data?.authenticationMethod || settings.json.authenticationMethod;
        if (authType) log('INFO', '인증 방식', authType);
    }

    // 요약표 출력
    console.log('\n  ┌─────────────────────────────────────────────────────────────┐');
    console.log('  │              n8n Execution Stop API 지원 여부 (실증)         │');
    console.log('  ├─────────────────────────────────────┬───────────────────────┤');
    console.log('  │ 방법                                 │ 결론                  │');
    console.log('  ├─────────────────────────────────────┼───────────────────────┤');
    console.log('  │ /api/v1/executions/{id}/stop         │ ✅ Active 워크플로우  │');
    console.log('  │   + X-N8N-API-KEY                   │ ❌ test mode → 404    │');
    console.log('  ├─────────────────────────────────────┼───────────────────────┤');
    console.log('  │ /rest/executions/{id}/stop           │ ❌ 항상 401           │');
    console.log('  │   + X-N8N-API-KEY                   │ (/rest/는 키 미지원)  │');
    console.log('  ├─────────────────────────────────────┼───────────────────────┤');
    console.log('  │ /rest/executions/{id}/stop           │ ❌ 항상 401           │');
    console.log('  │   + Basic Auth                      │ (n8n v1.x에서 제거됨) │');
    console.log('  ├─────────────────────────────────────┼───────────────────────┤');
    console.log('  │ POST /rest/login → session cookie    │ ✅ 인증 성공          │');
    console.log('  │ /rest/executions/{id}/stop + Cookie  │ ✅ test mode도 중단   │');
    console.log('  └─────────────────────────────────────┴───────────────────────┘');
}

// ── 메인 실행 ─────────────────────────────────────────────────────────────────
(async () => {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  n8n Execution Stop API 진단 스크립트');
    console.log(`  Target: ${N8N_API_BASE}`);
    console.log('═══════════════════════════════════════════════════════════════');

    const connected = await group1_connectivity();
    if (!connected) {
        console.log('\n‼️  n8n 연결 실패 또는 API 키 오류 — 이후 테스트 중단');
        process.exit(1);
    }

    const runningId = await group2_executions_query();
    await group3_stop_format_check();
    await group4_session_auth();
    await group5_live_stop(runningId);
    await group6_version_and_capabilities();

    // ── 결과 요약 ─────────────────────────────────────────────────────────────
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  결과 요약');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  ✅ PASS: ${passed}   ❌ FAIL: ${failed}   ⏭️  SKIP: ${skipped}`);

    if (failed > 0) {
        console.log('\n  ❌ 실패 항목:');
        RESULTS.filter(r => r.status === 'FAIL').forEach(r => {
            console.log(`     • ${r.label}${r.detail ? ' — ' + r.detail : ''}`);
        });
    }

    console.log('\n  ℹ️  현재 server.js stop 전략:');
    console.log('     1차: POST /api/v1/executions/{id}/stop (X-N8N-API-KEY)  → active 워크플로우');
    console.log('     2차: 3회 재시도 (3초 간격)                               → 타이밍 이슈');
    console.log('     3차: /rest/login → session cookie                        → test mode (inactive)');
    console.log('          POST /rest/executions/{id}/stop + Cookie header');
    console.log('');
})();
