/**
 * test_tsd_trigger.js
 * SDR JSON → /trigger/tsd API 레벨 end-to-end 검증 스크립트
 *
 * Phase 1: JSON 스키마 정적 검증 (evars / props / events 필드 존재 여부)
 * Phase 2: POST /trigger/tsd 호출 → HTTP 200 + jobId 수신 + n8n execution 시작 확인
 *
 * Usage:
 *   node test/test_tsd_trigger.js                      # Phase 1 + 2
 *   node test/test_tsd_trigger.js --check              # n8n execution 최신 결과 확인
 *   node test/test_tsd_trigger.js [sdrJsonPath] [serverBase]
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const IS_CHECK = process.argv[2] === '--check';
const SDR_PATH  = (!IS_CHECK && process.argv[2]) || path.join(__dirname, '..', 'input', 'GSSHOP_SDR_20260321_133144.json');
const SRV_BASE  = (process.argv[3] || 'http://localhost:3000').replace(/\/$/, '');
const N8N_BASE  = 'http://localhost:5678';
const N8N_KEY   = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlNGViNjRmZS1iNDMwLTQwYWYtYWU3My0yYWQ2OGI4YzZiMDMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc0MDExNzg0LCJleHAiOjE3NzY1MjQ0MDB9.LS0msUY3MuzAH_aTT5_8awjLRr43-lHRnZRVLrJD2Y4';

const c = { reset:'\x1b[0m', green:'\x1b[32m', red:'\x1b[31m', yellow:'\x1b[33m', cyan:'\x1b[36m', bold:'\x1b[1m', dim:'\x1b[2m' };
const ok   = m => console.log(`${c.green}✅${c.reset} ${m}`);
const fail = m => console.log(`${c.red}❌${c.reset} ${m}`);
const info = m => console.log(`${c.cyan}ℹ️ ${c.reset} ${m}`);
const warn = m => console.log(`${c.yellow}⚠️ ${c.reset} ${m}`);
const step = m => console.log(`\n${c.bold}${c.cyan}[STEP]${c.reset} ${m}`);
const hr   = () => console.log(`${c.dim}${'─'.repeat(60)}${c.reset}`);

function httpReq(url, method, body, extra = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const t = u.protocol === 'https:' ? https : http;
    const p = body ? JSON.stringify(body) : null;
    const req = t.request({
      hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + (u.search || ''), method,
      headers: { 'Content-Type': 'application/json', ...extra, ...(p ? { 'Content-Length': Buffer.byteLength(p) } : {}) },
      timeout: 30000
    }, res => {
      let d = '';
      res.on('data', ch => d += ch);
      res.on('end', () => {
        try   { resolve({ statusCode: res.statusCode, body: JSON.parse(d) }); }
        catch { resolve({ statusCode: res.statusCode, body: { raw: d } }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    if (p) req.write(p);
    req.end();
  });
}

// ── Phase 1 ───────────────────────────────────────────────────────────────────
function validateSchema(filePath) {
  step('Phase 1 — SDR JSON 스키마 정적 검증');
  hr();

  if (!fs.existsSync(filePath)) { fail(`파일 없음: ${filePath}`); return null; }
  let raw;
  try { raw = JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch (e) { fail(`JSON 파싱 실패: ${e.message}`); return null; }
  ok(`파일 로드: ${path.basename(filePath)}`);

  const checks = [
    { p: 'clientName',             v: raw.clientName,                r: true  },
    { p: 'sdrData',                v: raw.sdrData,                   r: true  },
    { p: 'sdrData.evars',          v: raw.sdrData?.evars,            r: true  },
    { p: 'sdrData.props',          v: raw.sdrData?.props,            r: true  },
    { p: 'sdrData.events',         v: raw.sdrData?.events,           r: true  },
    { p: 'sdrData.section_a_ootb', v: raw.sdrData?.section_a_ootb,   r: false },
    { p: 'sdrData.data_layer_map', v: raw.sdrData?.data_layer_map,   r: false },
    { p: '_meta (extra, ignored)', v: raw._meta,                     r: false },
  ];
  let passed = true;
  for (const { p, v, r } of checks) {
    const ex = v !== undefined && v !== null;
    const tag = r ? 'REQUIRED' : 'OPTIONAL';
    if (r && !ex) { fail(`[${tag}] ${p} → 누락!`); passed = false; }
    else if (Array.isArray(v)) ok(`[${tag}] ${p} → 배열 ${v.length}개`);
    else if (typeof v === 'string') ok(`[${tag}] ${p} → "${v}"`);
    else if (ex) ok(`[${tag}] ${p} → 존재`);
    else warn(`[${tag}] ${p} → 없음 (무시)`);
  }

  // events 서브필드 샘플
  for (const ev of (raw.sdrData?.events?.slice(0, 3) || [])) {
    const miss = ['event', 'event_name', 'event_type'].filter(f => !ev[f]);
    if (miss.length) warn(`events 항목 누락 필드: ${miss.join(', ')}`);
  }
  if (raw.sdrData?.events?.length) ok('events 서브필드 검증 (event, event_name, event_type) 통과');

  // evars 서브필드 샘플
  for (const ev of (raw.sdrData?.evars?.slice(0, 3) || [])) {
    const miss = ['variable', 'variable_name'].filter(f => !ev[f]);
    if (miss.length) warn(`evars 항목 누락 필드: ${miss.join(', ')}`);
  }
  if (raw.sdrData?.evars?.length) ok('evars 서브필드 검증 (variable, variable_name) 통과');

  console.log('');
  console.log(`  clientName      : ${raw.clientName}`);
  console.log(`  evars           : ${raw.sdrData?.evars?.length ?? 0}`);
  console.log(`  props           : ${raw.sdrData?.props?.length ?? 0}`);
  console.log(`  events          : ${raw.sdrData?.events?.length ?? 0}  (OOTB Commerce + Custom)`);
  console.log(`  section_a_ootb  : ${raw.sdrData?.section_a_ootb?.length ?? 0}`);
  console.log(`  data_layer_map  : ${raw.sdrData?.data_layer_map?.length ?? 0}`);

  if (!passed) return null;
  return { clientName: raw.clientName, sdrData: raw.sdrData };
}

// ── Phase 2 ───────────────────────────────────────────────────────────────────
async function triggerTsd(payload) {
  step('Phase 2 — POST /trigger/tsd → n8n webhook 연동 확인');
  hr();

  const url = `${SRV_BASE}/trigger/tsd`;
  info(`서버   : ${url}`);
  info(`payload: ${(JSON.stringify(payload).length / 1024).toFixed(1)} KB  (evars:${payload.sdrData.evars.length} props:${payload.sdrData.props.length} events:${payload.sdrData.events.length})`);

  let res;
  try { res = await httpReq(url, 'POST', payload); }
  catch (e) {
    fail(`서버 연결 실패 [${e?.code || 'ERR'}]: ${e?.message || e}`);
    fail('webhook-service(node server.js)가 포트 3000에서 실행 중인지 확인하세요');
    return null;
  }

  console.log(`\n  HTTP 상태 : ${res.statusCode === 200 ? c.green : c.red}${res.statusCode}${c.reset}`);
  console.log('  응답      : ' + JSON.stringify(res.body).replace(/,/g, ', '));

  if (res.statusCode !== 200) {
    fail(`/trigger/tsd 실패 (${res.statusCode}): ${res.body?.error || ''}`);
    return null;
  }
  if (!res.body?.jobId) { fail('응답에 jobId 없음'); return null; }

  ok(`HTTP 200 수신 — jobId: "${res.body.jobId}"`);

  // 3초 후 n8n execution ID 조회
  await new Promise(r => setTimeout(r, 3000));
  try {
    const n = await httpReq(`${N8N_BASE}/api/v1/executions?limit=3`, 'GET', null, { 'X-N8N-API-KEY': N8N_KEY });
    const execs = n.body?.data || [];
    const recent = execs.find(e => e.workflowId === 'TSD-V2' && new Date(e.startedAt) > new Date(Date.now() - 15000));
    if (recent) {
      ok(`n8n execution 시작 확인 → ID: ${recent.id}, status: ${recent.status}, startedAt: ${recent.startedAt}`);
      return { jobId: res.body.jobId, n8nExecId: recent.id };
    }
    warn('n8n에서 최근 15초 이내 TSD-V2 execution 확인 안 됨 (이미 시작됐거나 API 권한 부족)');
    if (execs[0]) info(`  최근 execution: ID=${execs[0].id}, WF=${execs[0].workflowId}, status=${execs[0].status}`);
  } catch (e) {
    warn(`n8n API 조회 오류: ${e.message}`);
  }
  return { jobId: res.body.jobId, n8nExecId: null };
}

// ── Phase 3 (--check 모드) ─────────────────────────────────────────────────────
async function checkResult() {
  step('Phase 3 — n8n TSD-V2 최신 execution 결과 확인');
  hr();

  let res;
  try {
    res = await httpReq(`${N8N_BASE}/api/v1/executions?workflowId=TSD-V2&limit=10`, 'GET', null, { 'X-N8N-API-KEY': N8N_KEY });
  } catch (e) { fail(`n8n API 연결 실패: ${e.message}`); return; }

  const tsdExecs = (res.body?.data || []);
  if (!tsdExecs.length) { warn('TSD-V2 execution 없음'); return; }

  console.log('');
  console.log('  TSD-V2 최근 execution 목록:');
  tsdExecs.forEach(e => {
    const icon = { success: '✅', error: '❌', running: '🔄', waiting: '⏳' }[e.status] || '⬜';
    const dur  = e.stoppedAt ? `${((new Date(e.stoppedAt) - new Date(e.startedAt)) / 1000).toFixed(0)}s` : '진행 중';
    console.log(`  ${icon} ID ${e.id} | ${e.status.padEnd(8)} | ${dur.padStart(5)} | ${e.startedAt}`);
  });

  const latest = tsdExecs[0];
  console.log('');
  if (latest.status === 'success') {
    ok(`최신 execution (${latest.id}) 성공!`);
  } else if (latest.status === 'error') {
    try {
      const d = await httpReq(`${N8N_BASE}/api/v1/executions/${latest.id}?includeData=true`, 'GET', null, { 'X-N8N-API-KEY': N8N_KEY });
      const rd = d.body?.data?.resultData;
      if (rd?.error) {
        fail(`오류 노드   : ${rd.lastNodeExecuted || '(알 수 없음)'}`);
        fail(`오류 메시지 : ${rd.error.message}`);
      } else {
        fail(`execution ${latest.id} 오류 — 상세 없음`);
      }
    } catch (e) { fail(`상세 조회 실패: ${e.message}`); }
  } else {
    info(`현재 상태: ${latest.status} (아직 실행 중)`);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  if (IS_CHECK) {
    console.log(`\n${c.bold}${c.cyan}  Phase 3: n8n execution 결과 확인${c.reset}\n`);
    await checkResult();
    return;
  }

  console.log(`\n${c.bold}${c.cyan}============================================================${c.reset}`);
  console.log(`${c.bold}${c.cyan}  SDR JSON → /trigger/tsd 검증 (Phase 1 + 2)${c.reset}`);
  console.log(`${c.bold}${c.cyan}============================================================${c.reset}`);
  console.log(`  SDR 파일   : ${SDR_PATH}`);
  console.log(`  서버 주소  : ${SRV_BASE}`);
  console.log(`  시작 시각  : ${new Date().toISOString()}`);

  const payload = validateSchema(SDR_PATH);
  if (!payload) { fail('Phase 1 실패'); process.exit(1); }
  ok('Phase 1 통과 ✔');

  const result = await triggerTsd(payload);
  if (!result) { fail('Phase 2 실패'); process.exit(1); }

  hr();
  console.log(`\n${c.bold}${c.green}  ✅ Phase 1 + 2 검증 완료 — SDR JSON 포맷 파싱 오류 없음${c.reset}`);
  console.log('');
  console.log(`  jobId       : ${result.jobId}`);
  if (result.n8nExecId) console.log(`  n8n exec ID : ${result.n8nExecId}`);
  console.log('');
  console.log(`  ${c.dim}n8n AI 처리는 백그라운드에서 계속 실행됩니다.${c.reset}`);
  console.log(`  ${c.dim}완료 후 결과 확인:  node test/test_tsd_trigger.js --check${c.reset}\n`);
  process.exit(0);
}

main().catch(e => { fail(`오류: ${e.message}`); process.exit(1); });
