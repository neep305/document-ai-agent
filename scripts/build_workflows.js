/**
 * Build script: splits document_ai_v1.5.json into 3 independent workflows
 *   - document_ai_SDR_v2.0.json  (BRD Excel → SDR Excel)
 *   - document_ai_TSD_v2.0.json  (sdrData JSON → TSD files)
 *   - document_ai_Tags_v2.0.json (sdrData JSON → Adobe Launch rules)
 */

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '../n8n-cloud/n8n-template/document_ai_v1.5.json');
const OUT = path.join(__dirname, '../n8n-cloud/n8n-template');

const src = JSON.parse(fs.readFileSync(SRC, 'utf8'));

// ── helpers ────────────────────────────────────────────────────────────────
function getNode(name) {
  const n = src.nodes.find(x => x.name === name);
  if (!n) throw new Error('Node not found: ' + name);
  return JSON.parse(JSON.stringify(n)); // deep clone
}

function getNodes(names) {
  return names.map(name => {
    const n = src.nodes.find(x => x.name === name);
    if (!n) { console.warn('WARN: Node not found:', name); return null; }
    return JSON.parse(JSON.stringify(n));
  }).filter(Boolean);
}

function getConns(names) {
  const allNames = new Set(names);
  const conns = {};
  for (const [from, c] of Object.entries(src.connections)) {
    if (!allNames.has(from)) continue;
    const filtered = {};
    for (const [type, outputs] of Object.entries(c)) {
      filtered[type] = outputs.map(targets =>
        targets.filter(t => allNames.has(t.node))
      );
    }
    conns[from] = filtered;
  }
  return conns;
}

// ════════════════════════════════════════════════════════════════════════════
// 1. SDR WORKFLOW
// ════════════════════════════════════════════════════════════════════════════
const SDR_NAMES = [
  'Webhook Trigger', 'Set Webhook Config', 'Generate Job ID', 'Extract and Validate',
  'Create Binary', 'Read Requirements Sheet', 'Fill Down Merged Cells', 'Parse Requirements',
  'Wait 30s (TPM buffer)', 'TPM Monitor',
  'Azure OpenAI - SDR eVars', 'Tool: Get Requirements', 'Tool: Get SDR Guide', 'SDR eVars Agent',
  'Azure OpenAI - Props Events', 'Tool: Get Generated eVars', 'Tool: Get Requirements (P2)',
  'Tool: Get SDR Guide (P2)', 'SDR Props Events Agent',
  'Merge SDR Parts', 'Parse SDR Output',
  'Generate SDR Excel v1', 'Check SDR Binary', 'Find SDR Folder', 'SDR Folder Check',
  'SDR Folder Exists?', 'Create SDR Folder', 'Prepare SDR for Upload',
  'Upload SDR Excel to GDrive', 'Collect SDR Upload Result',
  'Notify Step SDR Done', 'Notify Step Excel Done', 'Respond with JSON',
  'Notify Error', 'Notify Callback', 'Notify Excel Start',
];

const sdrNodes = getNodes(SDR_NAMES).map(n => {
  // Change webhook path to 'sdr'
  if (n.name === 'Webhook Trigger') {
    n.parameters.path = 'sdr';
    n.webhookId = '11111111-1111-1111-1111-111111111111';
  }
  return n;
});

const sdrConns = getConns(SDR_NAMES);

const sdrWorkflow = {
  name: 'Document AI - SDR v2.0',
  nodes: sdrNodes,
  pinData: {},
  connections: sdrConns,
  active: false,
  settings: { executionOrder: 'v1' },
  versionId: 'sdr-v2-0001-0001-000000000001',
  meta: { templateCredsSetupCompleted: true },
  id: 'SDR-V2',
  tags: [{ id: 'tag-sdr', name: 'sdr', createdAt: '2026-03-20T00:00:00.000Z', updatedAt: '2026-03-20T00:00:00.000Z' }],
};

fs.writeFileSync(path.join(OUT, 'document_ai_SDR_v2.0.json'), JSON.stringify(sdrWorkflow, null, 2));
console.log('✅ SDR workflow written:', sdrNodes.length, 'nodes');

// ════════════════════════════════════════════════════════════════════════════
// 2. TSD WORKFLOW
// ════════════════════════════════════════════════════════════════════════════
const TSD_NAMES_FROM_SRC = [
  'Azure OpenAI - TSD JS', 'Structured Output Parser', 'Azure OpenAI - SOP', 'TSD JS Agent',
  'Azure OpenAI - TSD Doc', 'TSD Doc Agent',
  'Wait 30s (TSD TPM buffer)', 'Wait 35s (pre-TSD TPM)', 'Merge TSD Parts', 'Parse TSD Output',
  'Generate TSD DOCX', 'Create TSD Folder', 'Create Client Folder',
  'Split Files for Upload', 'Upload to Google Drive', 'Collect Upload Results',
  'Notify Step TSD Done', 'Notify TSD Start', 'Log Error',
];

// New nodes for TSD standalone
const tsdWebhookNode = {
  parameters: { httpMethod: 'POST', path: 'tsd', responseMode: 'responseNode', options: {} },
  id: '22222222-2222-2222-2222-222222222221', name: 'Webhook Trigger TSD',
  type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [200, 300],
  webhookId: '22222222-2222-2222-2222-222222222221',
};

const tsdValidateNode = {
  parameters: {
    jsCode: `const input = $input.first().json;
const body = input.body || input;
const jobId = body.jobId || ('tsd-' + Date.now() + '-' + Math.random().toString(36).substr(2, 8));
const clientName = body.clientName;
const sdrData = body.sdrData || body.sdr;
const callbackUrl = body.callbackUrl || null;

if (!clientName || !sdrData) throw new Error('Missing required fields: clientName, sdrData');
if (!sdrData.evars || !sdrData.props || !sdrData.events) {
  throw new Error('sdrData must contain evars, props, and events');
}

console.log('=== TSD Job ===');
console.log('Job ID:', jobId);
console.log('Client:', clientName);
console.log('eVars:', sdrData.evars.length, 'Props:', sdrData.props.length, 'Events:', sdrData.events.length);

return [{ json: { jobId, clientName, sdrData, callbackUrl, jobStartedAt: new Date().toISOString() } }];`,
  },
  id: '22222222-2222-2222-2222-222222222222', name: 'Validate TSD Input',
  type: 'n8n-nodes-base.code', typeVersion: 2, position: [600, 300],
};

const tsdRespondNode = {
  parameters: {
    respondWith: 'json',
    responseBody: "={{ JSON.stringify({ success: true, jobId: $('Validate TSD Input').first().json.jobId, message: 'TSD 생성이 시작되었습니다.' }) }}",
    options: {},
  },
  id: '22222222-2222-2222-2222-222222222223', name: 'Respond TSD',
  type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [1000, 200],
};

// Shim: re-shapes sdrData into the format Prepare TSD Input used to produce from Parse SDR Output
const tsdPrepareNode = {
  parameters: {
    jsCode: `const input = $('Validate TSD Input').first().json;
const tsdPayload = {
  body: [{
    clientName: input.clientName,
    sdr: input.sdrData
  }]
};
return [{ json: tsdPayload }];`,
  },
  id: '22222222-2222-2222-2222-222222222224', name: 'Prepare TSD Input',
  type: 'n8n-nodes-base.code', typeVersion: 2, position: [1000, 400],
};

const tsdNotifyErrorNode = {
  parameters: {
    method: 'POST',
    url: "={{ $('Validate TSD Input').first().json.callbackUrl || 'http://host.docker.internal:3000/webhook/sdr-result' }}",
    sendBody: true, specifyBody: 'json',
    jsonBody: "={{ JSON.stringify({ jobId: $('Validate TSD Input').first().json.jobId, status: 'failed', error: $json.error?.message || 'TSD generation failed', failedAt: new Date().toISOString() }) }}",
    options: { timeout: 10000 },
  },
  id: '22222222-2222-2222-2222-222222222225', name: 'Notify TSD Error',
  type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2,
  position: [1400, 600], continueOnFail: true,
};

const tsdNodesFromSrc = getNodes(TSD_NAMES_FROM_SRC).map(n => {
  if (n.name === 'Notify Step TSD Done') {
    n.parameters.url = "={{ $('Validate TSD Input').first().json.callbackUrl || 'http://host.docker.internal:3000/webhook/sdr-result' }}";
    n.parameters.jsonBody = "={{ JSON.stringify({ jobId: $('Validate TSD Input').first().json.jobId, status: 'step_tsd_done', message: 'TSD 문서 생성 완료' }) }}";
  }
  return n;
});

// All TSD node names for connection filtering
const ALL_TSD_NAMES = [
  'Webhook Trigger TSD', 'Validate TSD Input', 'Respond TSD', 'Prepare TSD Input', 'Notify TSD Error',
  ...TSD_NAMES_FROM_SRC,
];

const tsdConns = getConns(ALL_TSD_NAMES);
tsdConns['Webhook Trigger TSD'] = { main: [[{ node: 'Validate TSD Input', type: 'main', index: 0 }]] };
tsdConns['Validate TSD Input'] = { main: [[
  { node: 'Respond TSD', type: 'main', index: 0 },
  { node: 'Prepare TSD Input', type: 'main', index: 0 },
]] };
tsdConns['Prepare TSD Input'] = { main: [[{ node: 'Wait 35s (pre-TSD TPM)', type: 'main', index: 0 }]] };

const allTsdNodes = [
  tsdWebhookNode, tsdValidateNode, tsdRespondNode, tsdPrepareNode, tsdNotifyErrorNode,
  ...tsdNodesFromSrc,
];

const tsdWorkflow = {
  name: 'Document AI - TSD v2.0',
  nodes: allTsdNodes,
  pinData: {},
  connections: tsdConns,
  active: false,
  settings: { executionOrder: 'v1' },
  versionId: 'tsd-v2-0001-0001-000000000001',
  meta: { templateCredsSetupCompleted: true },
  id: 'TSD-V2',
  tags: [{ id: 'tag-tsd', name: 'tsd', createdAt: '2026-03-20T00:00:00.000Z', updatedAt: '2026-03-20T00:00:00.000Z' }],
};

fs.writeFileSync(path.join(OUT, 'document_ai_TSD_v2.0.json'), JSON.stringify(tsdWorkflow, null, 2));
console.log('✅ TSD workflow written:', allTsdNodes.length, 'nodes');

// ════════════════════════════════════════════════════════════════════════════
// 3. TAGS WORKFLOW
// ════════════════════════════════════════════════════════════════════════════
const TAGS_NAMES_FROM_SRC = [
  'Set Credentials', 'Get IMS Access Token', 'Merge Token & Credentials',
  'Get Existing Extensions', 'Parse Extensions', 'Prepare Rules (Dynamic)',
  'Loop Rules', 'Create Rule', 'Prepare Components', 'Loop Components',
  'Create Rule Component', 'Component Created?', 'Check Rule Setup', 'Verify Rule',
  'Final Summary', 'Log Error', 'Notify Done Start',
];

const tagsWebhookNode = {
  parameters: { httpMethod: 'POST', path: 'tags', responseMode: 'responseNode', options: {} },
  id: '33333333-3333-3333-3333-333333333331', name: 'Webhook Trigger Tags',
  type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [200, 300],
  webhookId: '33333333-3333-3333-3333-333333333331',
};

const tagsValidateNode = {
  parameters: {
    jsCode: `const input = $input.first().json;
const body = input.body || input;
const jobId = body.jobId || ('tags-' + Date.now() + '-' + Math.random().toString(36).substr(2, 8));
const clientName = body.clientName;
const sdrData = body.sdrData || body.sdr;
const callbackUrl = body.callbackUrl || null;

if (!clientName || !sdrData) throw new Error('Missing required fields: clientName, sdrData');
if (!sdrData.evars || !sdrData.events) {
  throw new Error('sdrData must contain evars and events for Tags creation');
}

console.log('=== Tags Job ===');
console.log('Job ID:', jobId);
console.log('Client:', clientName);
console.log('eVars:', sdrData.evars.length, 'Events:', sdrData.events.length);

return [{ json: { jobId, clientName, sdrData, callbackUrl, jobStartedAt: new Date().toISOString() } }];`,
  },
  id: '33333333-3333-3333-3333-333333333332', name: 'Validate Tags Input',
  type: 'n8n-nodes-base.code', typeVersion: 2, position: [600, 300],
};

const tagsRespondNode = {
  parameters: {
    respondWith: 'json',
    responseBody: "={{ JSON.stringify({ success: true, jobId: $('Validate Tags Input').first().json.jobId, message: 'Tags 생성이 시작되었습니다.' }) }}",
    options: {},
  },
  id: '33333333-3333-3333-3333-333333333333', name: 'Respond Tags',
  type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [1000, 200],
};

// ParseSDRForTags: shim that makes sdrData available as 'Parse SDR Output' for downstream Set Credentials reference
// Actually the downstream nodes (Set Credentials, Get IMS Access Token etc.) don't read from Parse SDR Output
// But Prepare Rules (Dynamic) reads from Parse SDR Output (to get evars/events)
// We need to make sdrData accessible as if it came from Parse SDR Output

const tagsParseShimNode = {
  parameters: {
    jsCode: `const input = $('Validate Tags Input').first().json;
// Emulate the shape that Prepare Rules (Dynamic) expects from Parse SDR Output
return [{ json: {
  success: true,
  clientName: input.clientName,
  sdr: input.sdrData,
  stats: {
    evars: input.sdrData.evars?.length || 0,
    props: input.sdrData.props?.length || 0,
    events: input.sdrData.events?.length || 0,
  },
  validation: { coverage_pct: 100, warnings: [] },
} }];`,
  },
  id: '33333333-3333-3333-3333-333333333334', name: 'Parse SDR Output',
  type: 'n8n-nodes-base.code', typeVersion: 2, position: [1000, 400],
};

const tagsNotifyDoneNode = {
  parameters: {
    method: 'POST',
    url: "={{ $('Validate Tags Input').first().json.callbackUrl || 'http://host.docker.internal:3000/webhook/sdr-result' }}",
    sendBody: true, specifyBody: 'json',
    jsonBody: "={{ JSON.stringify({ jobId: $('Validate Tags Input').first().json.jobId, status: 'completed', message: 'Adobe Launch Tags 생성 완료', completedAt: new Date().toISOString() }) }}",
    options: { timeout: 10000 },
  },
  id: '33333333-3333-3333-3333-333333333335', name: 'Notify Tags Done',
  type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2,
  position: [3600, 300], continueOnFail: true,
};

const tagsNotifyErrorNode = {
  parameters: {
    method: 'POST',
    url: "={{ $('Validate Tags Input').first().json.callbackUrl || 'http://host.docker.internal:3000/webhook/sdr-result' }}",
    sendBody: true, specifyBody: 'json',
    jsonBody: "={{ JSON.stringify({ jobId: $('Validate Tags Input').first().json.jobId, status: 'failed', error: $json.error?.message || 'Tags creation failed', failedAt: new Date().toISOString() }) }}",
    options: { timeout: 10000 },
  },
  id: '33333333-3333-3333-3333-333333333336', name: 'Notify Tags Error',
  type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2,
  position: [1400, 600], continueOnFail: true,
};

const tagsRespondFinalNode = {
  parameters: {
    respondWith: 'json',
    responseBody: "={{ JSON.stringify({ success: true, jobId: $('Validate Tags Input').first().json.jobId, message: 'Adobe Launch Tags 생성 완료' }) }}",
    options: {},
  },
  id: '33333333-3333-3333-3333-333333333337', name: 'Respond Tags Final',
  type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [3800, 400],
};

const tagsNodesFromSrc = getNodes(TAGS_NAMES_FROM_SRC).map(n => {
  // Collect Upload Results is used in Final Summary but not in Tags workflow
  // Final Summary references Collect Upload Results which doesn't exist here
  // Update Final Summary to not reference it
  if (n.name === 'Final Summary') {
    n.parameters.jsCode = `const items = $input.all();
const clientName = $('Validate Tags Input').first().json.clientName || 'Unknown';

return [{
  json: {
    success: true,
    clientName: clientName,
    message: 'Adobe Launch Rules deployed successfully',
    summary: {
      rulesCreated: items.length,
      componentsCreated: 'Events, Conditions, Actions included',
    },
    nextSteps: [
      '1. Verify created rules in Adobe Launch UI',
      '2. Create Library and build to Development environment',
      '3. QA test all tracking events',
      '4. Promote to Production after sign-off',
    ],
  }
}];`;
  }
  // Notify Done Start - update to use Validate Tags Input for jobId
  if (n.name === 'Notify Done Start') {
    n.parameters.url = "={{ $('Validate Tags Input').first().json.callbackUrl || 'http://host.docker.internal:3000/webhook/sdr-result' }}";
    n.parameters.jsonBody = "={{ JSON.stringify({ jobId: $('Validate Tags Input').first().json.jobId, status: 'step_tags_start', message: 'Adobe Launch Tags 생성 시작' }) }}";
  }
  return n;
});

const ALL_TAGS_NAMES = [
  'Webhook Trigger Tags', 'Validate Tags Input', 'Respond Tags', 'Parse SDR Output',
  'Notify Tags Done', 'Notify Tags Error', 'Respond Tags Final',
  ...TAGS_NAMES_FROM_SRC,
];

const tagsConns = getConns(ALL_TAGS_NAMES);

// Override/add missing connections
tagsConns['Webhook Trigger Tags'] = { main: [[{ node: 'Validate Tags Input', type: 'main', index: 0 }]] };
tagsConns['Validate Tags Input'] = { main: [[
  { node: 'Respond Tags', type: 'main', index: 0 },
  { node: 'Parse SDR Output', type: 'main', index: 0 },
]] };
tagsConns['Parse SDR Output'] = { main: [[{ node: 'Set Credentials', type: 'main', index: 0 }]] };

// Set Credentials → Get IMS Access Token (original connection should be there already)
// Final Summary → Notify Tags Done → Respond Tags Final
tagsConns['Final Summary'] = { main: [[{ node: 'Notify Tags Done', type: 'main', index: 0 }]] };
tagsConns['Notify Tags Done'] = { main: [[{ node: 'Respond Tags Final', type: 'main', index: 0 }]] };

const allTagsNodes = [
  tagsWebhookNode, tagsValidateNode, tagsRespondNode, tagsParseShimNode,
  tagsNotifyDoneNode, tagsNotifyErrorNode, tagsRespondFinalNode,
  ...tagsNodesFromSrc,
];

const tagsWorkflow = {
  name: 'Document AI - Tags v2.0',
  nodes: allTagsNodes,
  pinData: {},
  connections: tagsConns,
  active: false,
  settings: { executionOrder: 'v1' },
  versionId: 'tags-v2-0001-0001-000000000001',
  meta: { templateCredsSetupCompleted: true },
  id: 'TAGS-V2',
  tags: [{ id: 'tag-tags', name: 'tags', createdAt: '2026-03-20T00:00:00.000Z', updatedAt: '2026-03-20T00:00:00.000Z' }],
};

fs.writeFileSync(path.join(OUT, 'document_ai_Tags_v2.0.json'), JSON.stringify(tagsWorkflow, null, 2));
console.log('✅ Tags workflow written:', allTagsNodes.length, 'nodes');

// ── Final validation ──────────────────────────────────────────────────────
console.log('\n=== Validation ===');
[
  ['SDR', sdrWorkflow],
  ['TSD', tsdWorkflow],
  ['Tags', tagsWorkflow],
].forEach(([name, wf]) => {
  try {
    JSON.parse(JSON.stringify(wf)); // roundtrip test
    console.log(`✅ ${name}: valid JSON, ${wf.nodes.length} nodes`);
  } catch (e) {
    console.error(`❌ ${name}: invalid JSON - ${e.message}`);
  }
});
