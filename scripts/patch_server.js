/**
 * Patches webhook-service/server.js to support 3-stage split:
 * - adds N8N_URLS config
 * - adds shared callN8nAndRegisterJob helper
 * - rewrites /trigger to use shared helper (backward compat for SDR)
 * - adds /trigger/sdr, /trigger/tsd, /trigger/tags endpoints
 * - updates STEP_TRANSITIONS for new step names
 */

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../webhook-service/server.js');
let src = fs.readFileSync(FILE, 'utf8');

// ── 1. Add N8N_URLS config after SHEET_NAMES block ──────────────────────────
const SHEET_NAMES_BLOCK_END = "  events: process.env.SHEET_NAME_EVENTS || 'custom events (metrics)'\n};";
const N8N_URLS_BLOCK = `  events: process.env.SHEET_NAME_EVENTS || 'custom events (metrics)'\n};\n\n// n8n Webhook URLs (3-stage split)\nconst N8N_URLS = {\n  sdr:  process.env.N8N_SDR_WEBHOOK_URL  || process.env.N8N_WEBHOOK_URL,\n  tsd:  process.env.N8N_TSD_WEBHOOK_URL,\n  tags: process.env.N8N_TAGS_WEBHOOK_URL,\n};`;

if (!src.includes('N8N_URLS')) {
  src = src.replace(SHEET_NAMES_BLOCK_END, N8N_URLS_BLOCK);
  console.log('✅ Added N8N_URLS config');
} else {
  console.log('⏭  N8N_URLS already present');
}

// ── 2. Replace entire /trigger handler + add /trigger/sdr, /trigger/tsd, /trigger/tags ──
// Find the start marker of /trigger route
const TRIGGER_START_MARKER = "app.post('/trigger',";
const triggerStart = src.indexOf(TRIGGER_START_MARKER);
if (triggerStart === -1) throw new Error('Could not find /trigger route start');

// Find the start of STEP_TRANSITIONS (the old /trigger handler ends right before it)
const stepTransStart = src.indexOf('const STEP_TRANSITIONS', triggerStart);
if (stepTransStart === -1) throw new Error('Could not find STEP_TRANSITIONS');

// The old trigger block is everything from triggerStart up to stepTransStart
// But there's a comment line right before STEP_TRANSITIONS that belongs to the STEP block
// Find that comment by searching backwards from stepTransStart
const beforeStepTrans = src.slice(0, stepTransStart);
const lastNewlineBeforeStepTrans = beforeStepTrans.lastIndexOf('\n// ');
// oldTriggerEnd = start of that last comment (which belongs to STEP_TRANSITIONS section)
const oldTriggerEnd = lastNewlineBeforeStepTrans; = `// ── Shared: call n8n webhook and register job ─────────────────────────────────────────────────────
async function callN8nAndRegisterJob(webhookUrl, payload, jobMeta) {
    const urlObj = new URL(webhookUrl);
    const isHttps = urlObj.protocol === 'https:';
    const transport = isHttps ? https : http;
    const payloadStr = JSON.stringify(payload);
    const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payloadStr) },
        timeout: 10000,
    };
    const n8nResponse = await new Promise((resolve, reject) => {
        const request = transport.request(options, (response) => {
            let data = '';
            response.on('data', chunk => { data += chunk; });
            response.on('end', () => {
                try { resolve({ statusCode: response.statusCode, body: JSON.parse(data) }); }
                catch { resolve({ statusCode: response.statusCode, body: { raw: data } }); }
            });
        });
        request.on('error', reject);
        request.on('timeout', () => { request.destroy(); reject(new Error('Request timeout')); });
        request.write(payloadStr);
        request.end();
    });
    const jobId = n8nResponse.body?.jobId || \`local-\${Date.now()}\`;
    const now = new Date().toISOString();
    jobs.set(jobId, { jobId, status: 'processing', createdAt: now, updatedAt: now, result: null, error: null, ...jobMeta });
    console.log(\`✅ Job registered: \${jobId} (stage: \${jobMeta.stage || 'unknown'})\`);
    return { jobId, n8nResponse };
}

// ── /trigger  (legacy alias → /trigger/sdr) ──────────────────────────────────────────────────────
// fileBase64 직접 전달 또는 fileName으로 input/ 폴더에서 읽기 (하위 호환)
app.post('/trigger', async (req, res) => {
    req.url = '/trigger/sdr';
    return app._router.handle(req, res, () => {});
});

// ── /trigger/sdr: BRD Excel → SDR 워크플로우 트리거 ────────────────────────────────────────────────
app.post('/trigger/sdr', async (req, res) => {
    try {
        const { fileName, clientName, fileBase64: bodyBase64, baseSheetName } = req.body;
        if (!fileName) return res.status(400).json({ error: 'fileName required' });
        if (!baseSheetName) return res.status(400).json({ error: 'baseSheetName required' });

        let base64;
        if (bodyBase64) {
            base64 = bodyBase64;
        } else {
            const filePath = path.join(__dirname, 'input', fileName);
            if (!fs.existsSync(filePath)) return res.status(404).json({ error: \`File not found: \${fileName}\` });
            base64 = fs.readFileSync(filePath).toString('base64');
        }

        const derivedClient = clientName || fileName.replace(/\\.[^.]+$/, '').replace(/[_-]+/g, ' ');
        const webhookUrl = N8N_URLS.sdr;
        if (!webhookUrl) return res.status(500).json({ error: 'N8N_SDR_WEBHOOK_URL (or N8N_WEBHOOK_URL) not set in .env' });

        const CALLBACK_HOST = process.env.CALLBACK_HOST || 'host.docker.internal';
        const callbackUrl = \`http://\${CALLBACK_HOST}:\${PORT}/webhook/sdr-result\`;
        const now = new Date().toISOString();

        console.log(\`🚀 SDR trigger: client="\${derivedClient}", file="\${fileName}" (\${(base64.length/1024).toFixed(1)} KB)\`);

        const { jobId } = await callN8nAndRegisterJob(webhookUrl,
            { clientName: derivedClient, fileName, fileBase64: base64, baseSheetName, callbackUrl },
            { clientName: derivedClient, fileName, stage: 'sdr',
              steps: [
                { step: 1, name: 'trigger', status: 'completed', updatedAt: now },
                { step: 2, name: 'sdr',     status: 'active',    updatedAt: now },
                { step: 3, name: 'excel',   status: 'pending',   updatedAt: null },
              ]
            }
        );

        res.json({ success: true, jobId, clientName: derivedClient, stage: 'sdr', message: 'SDR 생성이 시작되었습니다.' });
    } catch (err) {
        console.error('❌ /trigger/sdr error:', err.message || err);
        res.status(500).json({ error: err.message || String(err) });
    }
});

// ── /trigger/tsd: sdrData JSON → TSD 워크플로우 트리거 ──────────────────────────────────────────────
app.post('/trigger/tsd', async (req, res) => {
    try {
        const { clientName, sdrData, jobId: existingJobId } = req.body;
        if (!clientName) return res.status(400).json({ error: 'clientName required' });
        if (!sdrData)    return res.status(400).json({ error: 'sdrData required' });
        if (!sdrData.evars || !sdrData.props || !sdrData.events) {
            return res.status(400).json({ error: 'sdrData must contain evars, props, and events' });
        }

        const webhookUrl = N8N_URLS.tsd;
        if (!webhookUrl) return res.status(500).json({ error: 'N8N_TSD_WEBHOOK_URL not set in .env' });

        const CALLBACK_HOST = process.env.CALLBACK_HOST || 'host.docker.internal';
        const callbackUrl = \`http://\${CALLBACK_HOST}:\${PORT}/webhook/sdr-result\`;
        const now = new Date().toISOString();

        console.log(\`🚀 TSD trigger: client="\${clientName}", eVars=\${sdrData.evars.length}, Events=\${sdrData.events.length}\`);

        const { jobId } = await callN8nAndRegisterJob(webhookUrl,
            { clientName, sdrData, callbackUrl, jobId: existingJobId },
            { clientName, stage: 'tsd',
              steps: [
                { step: 1, name: 'trigger', status: 'completed', updatedAt: now },
                { step: 2, name: 'tsd_ai',  status: 'active',    updatedAt: now },
                { step: 3, name: 'tsd_docx',status: 'pending',   updatedAt: null },
              ]
            }
        );

        res.json({ success: true, jobId, clientName, stage: 'tsd', message: 'TSD 생성이 시작되었습니다.' });
    } catch (err) {
        console.error('❌ /trigger/tsd error:', err.message || err);
        res.status(500).json({ error: err.message || String(err) });
    }
});

// ── /trigger/tags: sdrData JSON → Tags(Adobe Launch) 워크플로우 트리거 ──────────────────────────────
app.post('/trigger/tags', async (req, res) => {
    try {
        const { clientName, sdrData, jobId: existingJobId } = req.body;
        if (!clientName) return res.status(400).json({ error: 'clientName required' });
        if (!sdrData)    return res.status(400).json({ error: 'sdrData required' });
        if (!sdrData.evars || !sdrData.events) {
            return res.status(400).json({ error: 'sdrData must contain evars and events for Tags creation' });
        }

        const webhookUrl = N8N_URLS.tags;
        if (!webhookUrl) return res.status(500).json({ error: 'N8N_TAGS_WEBHOOK_URL not set in .env' });

        const CALLBACK_HOST = process.env.CALLBACK_HOST || 'host.docker.internal';
        const callbackUrl = \`http://\${CALLBACK_HOST}:\${PORT}/webhook/sdr-result\`;
        const now = new Date().toISOString();

        console.log(\`🚀 Tags trigger: client="\${clientName}", eVars=\${sdrData.evars.length}, Events=\${sdrData.events.length}\`);

        const { jobId } = await callN8nAndRegisterJob(webhookUrl,
            { clientName, sdrData, callbackUrl, jobId: existingJobId },
            { clientName, stage: 'tags',
              steps: [
                { step: 1, name: 'trigger',    status: 'completed', updatedAt: now },
                { step: 2, name: 'tags_create', status: 'active',    updatedAt: now },
              ]
            }
        );

        res.json({ success: true, jobId, clientName, stage: 'tags', message: 'Tags 생성이 시작되었습니다.' });
    } catch (err) {
        console.error('❌ /trigger/tags error:', err.message || err);
        res.status(500).json({ error: err.message || String(err) });
    }
});

`;

// Find the end of the old /trigger handler (right before STEP_TRANSITIONS)
// The old handler ends right before the STEP_TRANSITIONS comment block
const STEP_TRANSITIONS_COMMENT = '// â\x94\x80â\x94\x80 n8n step ì½\x9cë°±';
const STEP_TRANSITIONS_COMMENT2 = '// n8n step \ucf5c\ubc31';
const STEP_TRANS_MARKER1 = src.indexOf(STEP_TRANSITIONS_COMMENT, triggerStart);
const STEP_TRANS_MARKER2 = src.indexOf(STEP_TRANSITIONS_COMMENT2, triggerStart);
const oldTriggerEnd = STEP_TRANS_MARKER1 !== -1 ? STEP_TRANS_MARKER1 : STEP_TRANS_MARKER2;

if (oldTriggerEnd === -1) throw new Error('Could not find end of /trigger handler');

// Replace the old /trigger block
const before = src.slice(0, triggerStart);
const after = src.slice(oldTriggerEnd);

src = before + NEW_TRIGGER_HANDLERS + after;
console.log('✅ Replaced /trigger handler and added /trigger/sdr, /trigger/tsd, /trigger/tags');

// ── 3. Update STEP_TRANSITIONS ───────────────────────────────────────────────
const OLD_TRANSITIONS = `const STEP_TRANSITIONS = {
    'step_sdr_done':    { complete: 'sdr'                },
    'step_excel_start': {                 activate: 'excel' },
    'step_excel_done':  { complete: 'excel'              },
    'step_tsd_start':   {                 activate: 'tsd'   },
    'step_tsd_done':    { complete: 'tsd'                },
    'step_done_start':  {                 activate: 'done'  },
};`;

const NEW_TRANSITIONS = `const STEP_TRANSITIONS = {
    // SDR stage
    'step_sdr_done':     { complete: 'sdr'                   },
    'step_excel_start':  {                 activate: 'excel'  },
    'step_excel_done':   { complete: 'excel'                  },
    // TSD stage
    'step_tsd_start':    {                 activate: 'tsd_ai' },
    'step_tsd_done':     { complete: 'tsd_ai', activate: 'tsd_docx' },
    // Tags stage
    'step_tags_start':   {                 activate: 'tags_create' },
    'step_tags_done':    { complete: 'tags_create'              },
    // Legacy
    'step_done_start':   {                 activate: 'done'   },
};`;

if (src.includes("'step_sdr_done':    { complete: 'sdr'")) {
  src = src.replace(OLD_TRANSITIONS, NEW_TRANSITIONS);
  console.log('✅ Updated STEP_TRANSITIONS');
} else {
  console.log('⏭  STEP_TRANSITIONS already updated or not found in expected form');
}

fs.writeFileSync(FILE, src, 'utf8');
console.log('✅ server.js patched successfully');
