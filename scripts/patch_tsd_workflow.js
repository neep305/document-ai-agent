#!/usr/bin/env node
/**
 * patch_tsd_workflow.js
 * Patches document_ai_TSD_v2.2.json to fix the require('docx') restriction:
 *
 * BEFORE: Parse TSD Output → Generate TSD DOCX (Code, uses require('docx'))
 * AFTER:  Parse TSD Output → Call DOCX Service (HTTP Request) → Generate TSD DOCX (Code, binary wrap only)
 *
 * The "Generate TSD DOCX" node NAME is preserved so "Split Files for Upload"
 * which references $('Generate TSD DOCX') continues to work without changes.
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const root        = path.join(__dirname, '..');
const workflowPath = path.join(root, 'n8n-cloud/n8n-template/document_ai_TSD_v2.2.json');

const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));

// ── Guard: skip if already patched ───────────────────────────────────────────
if (workflow.nodes.some(n => n.name === 'Call DOCX Service')) {
  console.log('✅ Workflow already patched — skipping.');
  process.exit(0);
}

// ── 1. Find existing "Generate TSD DOCX" node ────────────────────────────────
const docxNodeIdx = workflow.nodes.findIndex(n => n.name === 'Generate TSD DOCX');
if (docxNodeIdx === -1) {
  console.error('ERROR: "Generate TSD DOCX" node not found in workflow');
  process.exit(1);
}
const docxNode = workflow.nodes[docxNodeIdx];
const [docxX, docxY] = docxNode.position;

// ── 2. Replace Generate TSD DOCX jsCode with lightweight binary wrapper ──────
// No require() — just converts the DOCX Service JSON response into n8n binary
const simplifiedCode = `'use strict';

// ── Convert DOCX Service response into n8n binary ─────────────────────────────
// Input: $('Call DOCX Service').first().json → { success, base64, filename, mimeType, sectionCount }
const svcResult = $('Call DOCX Service').first().json;

if (!svcResult || !svcResult.success) {
  throw new Error('DOCX service returned failure: ' + (svcResult && svcResult.error || 'unknown error'));
}

const base64       = svcResult.base64;
const docxFilename = svcResult.filename;
const sectionCount = svcResult.sectionCount || 0;

if (!base64) {
  throw new Error('DOCX service response missing base64 field');
}

const clientName = $('Parse TSD Output').first().json.clientName || 'Client';

let preparedBinary;
try {
  if (this?.helpers?.prepareBinaryData) {
    const buffer = Buffer.from(base64, 'base64');
    preparedBinary = await this.helpers.prepareBinaryData(buffer, docxFilename);
  }
} catch (e) {
  console.warn('prepareBinaryData failed, using manual base64:', e?.message || e);
}

const manualBinary = {
  data: base64,
  mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  fileName: docxFilename,
};

return [{
  json: { clientName, filename: docxFilename, fileType: 'DOCX', sectionCount },
  binary: { data: (preparedBinary || manualBinary) },
}];
`;

docxNode.parameters.jsCode = simplifiedCode;
// Move to the right so the new HTTP node can take its original x position
docxNode.position = [docxX + 224, docxY];

// ── 3. Create "Call DOCX Service" HTTP Request node ───────────────────────────
const callDocxNode = {
  parameters: {
    method: 'POST',
    url: '={{ $env.DOCX_SERVICE_URL }}/generate-tsd?format=json',
    sendBody: true,
    specifyBody: 'json',
    jsonBody: `={{ JSON.stringify({
  clientName: $('Parse TSD Output').first().json.clientName,
  markdown:   $('Parse TSD Output').first().json.files.markdown.content,
  javascript: ($('Parse TSD Output').first().json.files && $('Parse TSD Output').first().json.files.javascript && $('Parse TSD Output').first().json.files.javascript.content) || ''
}) }}`,
    options: {
      timeout: 120000,
    },
  },
  id: crypto.randomUUID(),
  name: 'Call DOCX Service',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position: [docxX, docxY],
};

workflow.nodes.push(callDocxNode);

// ── 4. Update connections ─────────────────────────────────────────────────────
const conn = workflow.connections;

// a) Parse TSD Output success branch: replace "Generate TSD DOCX" with "Call DOCX Service"
const parseTsdConn = conn['Parse TSD Output'];
if (parseTsdConn && parseTsdConn.main && parseTsdConn.main[0]) {
  parseTsdConn.main[0] = parseTsdConn.main[0].map(edge =>
    edge.node === 'Generate TSD DOCX'
      ? { ...edge, node: 'Call DOCX Service' }
      : edge
  );
}

// b) Call DOCX Service → Generate TSD DOCX
conn['Call DOCX Service'] = {
  main: [
    [{ node: 'Generate TSD DOCX', type: 'main', index: 0 }],
  ],
};

// ── 5. Write output ───────────────────────────────────────────────────────────
// Backup original
const backupPath = workflowPath.replace('.json', '.bak.json');
fs.copyFileSync(workflowPath, backupPath);
console.log(`📦 Backup written to ${path.basename(backupPath)}`);

fs.writeFileSync(workflowPath, JSON.stringify(workflow, null, 2), 'utf8');
console.log('✅ Workflow patched:');
console.log('   • Added "Call DOCX Service" HTTP Request node (POST /generate-tsd?format=json)');
console.log('   • Replaced "Generate TSD DOCX" jsCode with lightweight binary wrapper (no require())');
console.log('   • Updated connections: Parse TSD Output → Call DOCX Service → Generate TSD DOCX');
console.log('');
console.log('⚙️  Required: Set DOCX_SERVICE_URL environment variable in n8n');
console.log('   Example: DOCX_SERVICE_URL=http://webhook-server:3000');
