#!/usr/bin/env node
/**
 * patch_tsd_docx_node.js
 * Updates document_ai_TSD_v2.2.json "Call DOCX Service" HTTP Request node URL
 * to use the DOCX_SERVICE_URL environment variable.
 *
 * Context: The old approach of inlining require('docx') in a Code node is replaced
 * by calling the webhook-service /generate-tsd?format=json endpoint. This script
 * updates the service URL in the workflow if needed.
 *
 * The workflow now follows:
 *   Parse TSD Output → Call DOCX Service (HTTP Request) → Generate TSD DOCX (Code, binary wrap)
 *
 * To use locally: Set DOCX_SERVICE_URL in your n8n environment, e.g.:
 *   DOCX_SERVICE_URL=http://localhost:3000   (local server)
 *   DOCX_SERVICE_URL=http://webhook-server:3000  (Docker service name)
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const root            = path.join(__dirname, '..');
const tsdTemplatePath = path.join(root, 'n8n-cloud/n8n-template/document_ai_TSD_v2.2.json');

// ── Check if already using the HTTP Request approach ──────────────────────────
const tsdJson = JSON.parse(fs.readFileSync(tsdTemplatePath, 'utf-8'));
const callDocxNode = tsdJson.nodes.find(n => n.name === 'Call DOCX Service');

if (!callDocxNode) {
  console.error('ERROR: "Call DOCX Service" node not found. Run patch_tsd_workflow.js first.');
  process.exit(1);
}

console.log('✅ Workflow already uses HTTP Request approach ("Call DOCX Service" node found).');
console.log('');
console.log('Current URL configured:', callDocxNode.parameters.url);
console.log('');
console.log('⚙️  To configure the DOCX service URL in n8n:');
console.log('   1. Go to n8n Settings → Environment Variables');
console.log('   2. Add: DOCX_SERVICE_URL = http://<your-webhook-service-host>:3000');
console.log('   3. Or set it in your .env file if using self-hosted n8n');
console.log('');
console.log('   Examples:');
console.log('   - Local machine:    DOCX_SERVICE_URL=http://localhost:3000');
console.log('   - Docker network:   DOCX_SERVICE_URL=http://webhook-server:3000');
console.log('   - Remote server:    DOCX_SERVICE_URL=https://your-server.example.com');
