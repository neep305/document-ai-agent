'use strict';

/**
 * patch_tsd_gdoc_branch.js
 *
 * - document_ai_TSD_v2.2.json에 Google Docs 생성 노드를 추가합니다.
 *   (Google Drive -> CreateFromText with convertToGoogleDocument=true)
 * - Collect Upload Results에서 Google Docs URL/id를 함께 콜백 페이로드로 내려보냅니다.
 */

const fs = require('fs');
const path = require('path');

const wfPath = path.join(__dirname, '../n8n-cloud/n8n-template/document_ai_TSD_v2.2.json');
const googleDriveCredId = 'AYG1qOCT9TIoQ4ia';
const googleDriveCredName = 'Google Drive account';

const workflow = JSON.parse(fs.readFileSync(wfPath, 'utf8'));

const makePublicNodeName = 'Make TSD File Public';
const collectNodeId = '0b8c156b-8cf6-48f5-859f-2bd658867fd8';

const newNode = {
  parameters: {
    resource: 'file',
    operation: 'createFromText',
    content: "={{ $('Parse TSD Output').first().json.files.markdown.content }}",
    name: "={{ $('Parse TSD Output').first().json.files.markdown.filename + '_gdoc' }}",
    driveId: {
      __rl: true,
      mode: 'list',
      value: 'My Drive',
    },
    folderId: {
      __rl: true,
      mode: 'id',
      value: "={{ $('Create Client Folder').first().json.id }}",
    },
    options: {
      convertToGoogleDocument: true,
    },
    optionsUi: {},
  },
  id: 'gdoc-tsd-create-0001-0001-000000000001',
  name: 'Create TSD Google Doc',
  type: 'n8n-nodes-base.googleDrive',
  typeVersion: 3,
  position: [31600, 2780],
  credentials: {
    googleDriveOAuth2Api: {
      id: googleDriveCredId,
      name: googleDriveCredName,
    },
  },
  continueOnFail: true,
};

// 1) Insert node after "Make TSD File Public"
const makePublicIdx = workflow.nodes.findIndex((n) => n.name === makePublicNodeName);
if (makePublicIdx === -1) throw new Error(`Cannot find node: ${makePublicNodeName}`);

if (!workflow.nodes.some((n) => n.name === newNode.name)) {
  workflow.nodes.splice(makePublicIdx + 1, 0, newNode);
}

// 2) Update connections: Make Public -> Create GDoc -> Collect
const makePublicConn = workflow.connections?.[makePublicNodeName];
if (!makePublicConn?.main?.length) throw new Error('Cannot find connections for Make TSD File Public');

// Replace the single-step branch with two sequential steps.
// Expected current shape:
// main: [ [ { node: 'Collect Upload Results', ... } ] ]
const mainBranches = makePublicConn.main;
makePublicConn.main = [
  [
    { node: newNode.name, type: 'main', index: 0 },
    { node: 'Collect Upload Results', type: 'main', index: 0 },
  ],
  ...mainBranches.slice(1),
];

// 3) Patch Collect Upload Results node jsCode
const collectNode = workflow.nodes.find((n) => n.id === collectNodeId);
if (!collectNode) throw new Error(`Cannot find Collect Upload Results node (${collectNodeId})`);

let jsCode = collectNode.parameters.jsCode;

// a) Insert Google Doc info extraction right before uploadedFiles.forEach
const marker = 'uploadedFiles.forEach';
const markerIdx = jsCode.indexOf(marker);
if (markerIdx === -1) throw new Error('Cannot find insertion marker in Collect Upload Results jsCode');

const googleDocBlock = [
  "const gdocNode = $('Create TSD Google Doc').first();",
  "const googleDocId = gdocNode?.json?.id || gdocNode?.json?.documentId || null;",
  "const googleDocUrl = googleDocId ? `https://docs.google.com/document/d/${googleDocId}/edit` : null;",
  'const googleDocs = googleDocUrl ? { id: googleDocId, url: googleDocUrl } : null;',
  '',
].join('\n');

if (!jsCode.includes('const googleDocs = googleDocUrl')) {
  jsCode = jsCode.slice(0, markerIdx) + googleDocBlock + '\n' + jsCode.slice(markerIdx);
}

// b) Add googleDocs into googleDrive object in return payload
const gdStart = jsCode.indexOf('googleDrive: {', 0);
const totalFilesNeedle = 'totalFiles: items.length';
const gdEnd = jsCode.indexOf(totalFilesNeedle, gdStart);
if (gdStart === -1 || gdEnd === -1) throw new Error('Cannot find googleDrive block to patch');

const gdBlock = jsCode.slice(gdStart, gdEnd);
if (!gdBlock.includes('fileTypes')) throw new Error('googleDrive block does not include fileTypes');

// Replace the last "fileTypes" property line inside googleDrive object.
// Example expected:
//   files: uploadedFiles,
//   fileTypes
// },
const gdBlockUpdated = gdBlock.replace(
  /(\s*)fileTypes(\s*)\n(\s*)\}/,
  (_m, p1, p2, p3) =>
    `${p1}fileTypes,${p2}\n${p3}googleDocs: googleDocs\n${p3}}`
);

if (!gdBlockUpdated.includes('googleDocs: googleDocs')) {
  throw new Error('Failed to insert googleDocs into googleDrive block');
}

jsCode = jsCode.slice(0, gdStart) + gdBlockUpdated + jsCode.slice(gdEnd);
collectNode.parameters.jsCode = jsCode;

fs.writeFileSync(wfPath, JSON.stringify(workflow, null, 2), 'utf8');
console.log('✅ Patched TSD v2.2 workflow with Google Docs node:', wfPath);

