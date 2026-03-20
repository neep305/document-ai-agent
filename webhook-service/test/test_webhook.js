/**
 * test_webhook.js
 * Direct n8n webhook test — sends BRD file payload to /webhook-test/sdr
 *
 * Usage:
 *   node test_webhook.js                          → uses defaults below
 *   node test_webhook.js [sheetName] [clientName] → override sheet / client
 *
 * Requirements: n8n must be running on port 5678 with a workflow open in
 * "Test workflow" mode (webhook-test path active).
 */

const fs   = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

// ── Config ────────────────────────────────────────────────────────────────────
const TARGET_URL  = process.env.WEBHOOK_URL || 'http://localhost:5678/webhook-test/sdr';
const FILE_PATH   = process.env.FILE_PATH   || path.join(__dirname, '..', 'input', 'AA_BRD_SDR_Test_01122026.xlsx');
const SHEET_NAME  = process.argv[2]         || 'Requirements_v2';
const CLIENT_NAME = process.argv[3]         || 'TestClient';
const TIMEOUT_MS  = 60_000;  // n8n test webhooks can be slow on first hit

// ── Load file ─────────────────────────────────────────────────────────────────
if (!fs.existsSync(FILE_PATH)) {
  console.error('❌  File not found:', FILE_PATH);
  process.exit(1);
}

const fileBase64 = fs.readFileSync(FILE_PATH).toString('base64');
const fileName   = path.basename(FILE_PATH);
console.log(`\n📂  File : ${fileName}  (${(fileBase64.length / 1024).toFixed(1)} KB base64)`);
console.log(`📋  Sheet: ${SHEET_NAME}`);
console.log(`🏢  Client: ${CLIENT_NAME}`);
console.log(`🎯  Target: ${TARGET_URL}\n`);

// ── Build payload ─────────────────────────────────────────────────────────────
const payload = JSON.stringify({
  clientName:    CLIENT_NAME,
  fileName:      fileName,
  fileBase64:    fileBase64,
  baseSheetName: SHEET_NAME,
});

// ── Send request ──────────────────────────────────────────────────────────────
const urlObj    = new URL(TARGET_URL);
const transport = urlObj.protocol === 'https:' ? https : http;

const options = {
  hostname: urlObj.hostname,
  port:     urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
  path:     urlObj.pathname,
  method:   'POST',
  headers: {
    'Content-Type':   'application/json',
    'Content-Length': Buffer.byteLength(payload),
  },
  timeout: TIMEOUT_MS,
};

console.log('⏳  Sending request...');
const startTime = Date.now();

const req = transport.request(options, (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅  Response  [${res.statusCode}]  (${elapsed}s)\n`);
    console.log('── Headers ──────────────────────────────────────');
    console.log('  Content-Type:', res.headers['content-type'] || '(none)');
    console.log('\n── Body ─────────────────────────────────────────');

    try {
      const parsed = JSON.parse(data);
      console.log(JSON.stringify(parsed, null, 2));

      // Summary
      console.log('\n── Summary ──────────────────────────────────────');
      if (parsed.jobId) {
        console.log('✅  jobId:', parsed.jobId);
      }
      if (parsed.sdr) {
        const sdr = parsed.sdr;
        console.log('   OOTB    :', (sdr.section_a_ootb || []).length);
        console.log('   eVars   :', (sdr.evars  || []).length);
        console.log('   Props   :', (sdr.props  || []).length);
        console.log('   Events  :', (sdr.events || []).length);
      }
      if (parsed.error) {
        console.log('❌  Error:', parsed.error);
      }
    } catch (_) {
      // Not JSON — print raw (truncated)
      console.log(data.slice(0, 2000));
      if (data.length > 2000) console.log(`... (truncated, total ${data.length} chars)`);
    }

    process.exit(res.statusCode === 200 ? 0 : 1);
  });
});

req.on('timeout', () => {
  console.error(`\n❌  Request timed out after ${TIMEOUT_MS / 1000}s`);
  req.destroy();
  process.exit(1);
});

req.on('error', (err) => {
  console.error('\n❌  Request error:', err.message);
  if (err.code === 'ECONNREFUSED') {
    console.error(`   → n8n is not running on ${urlObj.hostname}:${urlObj.port || 5678}`);
    console.error('   → Start n8n and open the workflow in "Test workflow" mode first.');
  }
  process.exit(1);
});

req.write(payload);
req.end();
