'use strict';

/**
 * patch_split_docx_binary.js
 * Updates document_ai_TSD_v2.2.json "Split Files for Upload" so DOCX binary is passed
 * as an object (binary.data) instead of copying binary.data.data (which can turn into undefined/"9 bytes").
 */

const fs = require('fs');

const wfPath = 'n8n-cloud/n8n-template/document_ai_TSD_v2.2.json';

const s0 = fs.readFileSync(wfPath, 'utf8');
let s = s0;

const reDocxBinary = /binary:\s*\{\s*data:\s*\{\s*data:\s*docxNode\.binary\.data\.data,\s*mimeType:\s*'application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document',\s*fileName:\s*docxFilename\s*\}\s*\}/;

if (!reDocxBinary.test(s)) throw new Error('DOCX binary pattern not found in workflow JSON');

s = s.replace(
  reDocxBinary,
  "binary: { data: { ...docxBinary, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', fileName: docxFilename } }"
);

fs.writeFileSync(wfPath, s, 'utf8');
console.log('✅ Patched split DOCX binary handling in', wfPath);

