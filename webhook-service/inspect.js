/**
 * Patch server.js: position-based surgery
 * triggerStart=5170, oldTriggerEnd=10011, stepTransStart=10095
 */
const fs = require('fs');
let src = fs.readFileSync('server.js', 'utf8');

// ── 1. Add N8N_URLS if not present ────────────────────────────────────────
if (!src.includes('N8N_URLS')) {
  const marker = "  events: process.env.SHEET_NAME_EVENTS || 'custom events (metrics)'\n};";
  const replacement = marker + "\n\n// n8n Webhook URLs (3-stage split)\nconst N8N_URLS = {\n  sdr:  process.env.N8N_SDR_WEBHOOK_URL  || process.env.N8N_WEBHOOK_URL,\n  tsd:  process.env.N8N_TSD_WEBHOOK_URL,\n  tags: process.env.N8N_TAGS_WEBHOOK_URL,\n};";
  src = src.replace(marker, replacement);
  console.log('✅ Added N8N_URLS');
} else {
  console.log('⏭  N8N_URLS already present');
}

// ── 2. Replace /trigger block with 3-stage handlers ───────────────────────
const TRIGGER_START = "app.post('/trigger',";
const STEP_TRANS_START = 'const STEP_TRANSITIONS';

const tStart = src.indexOf(TRIGGER_START);
const stStart = src.indexOf(STEP_TRANS_START, tStart);
const beforeST = src.slice(0, stStart);
const oldEnd = beforeST.lastIndexOf('\n// ');

if (tStart === -1 || stStart === -1 || oldEnd === -1) {
  throw new Error('Could not find splice positions: ' + JSON.stringify({ tStart, stStart, oldEnd }));
}

const newHandlers = `// ── Shared: call n8n webhook and register job ──────────────────────────────────────────────────────
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
    const jobId = n8nResponse.body?.jobId || ('local-' + Date.now());
    const now = new Date().toISOString();
    jobs.set(jobId, { jobId, status: 'processing', createdAt: now, updatedAt: now, result: null, error: null, ...jobMeta });
    console.log('✅ Job registered: ' + jobId + ' (stage: ' + (jobMeta.stage || 'unknown') + ')');
    return { jobId, n8nResponse };
}

// ── /trigger  (legacy alias → /trigger/sdr, 하위 호환) ──────────────────────────────────────────────
app.post('/trigger', async (req, res) => {
    req.url = '/trigger/sdr';
    return app._router.handle(req, res, () => {});
});

// ── /trigger/sdr: BRD Excel → SDR 워크플로우 트리거 ──────────────────────────────────────────────────
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
            if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found: ' + fileName });
            base64 = fs.readFileSync(filePath).toString('base64');
        }

        const derivedClient = clientName || fileName.replace(/\\.[^.]+$/, '').replace(/[_-]+/g, ' ');
        const webhookUrl = N8N_URLS.sdr;
        if (!webhookUrl) return res.status(500).json({ error: 'N8N_SDR_WEBHOOK_URL (or N8N_WEBHOOK_URL) not set in .env' });

        const CALLBACK_HOST = process.env.CALLBACK_HOST || 'host.docker.internal';
        const callbackUrl = 'http://' + CALLBACK_HOST + ':' + PORT + '/webhook/sdr-result';
        const now = new Date().toISOString();

        console.log('🚀 SDR trigger: client="' + derivedClient + '", file="' + fileName + '" (' + (base64.length/1024).toFixed(1) + ' KB)');

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
        const callbackUrl = 'http://' + CALLBACK_HOST + ':' + PORT + '/webhook/sdr-result';
        const now = new Date().toISOString();

        console.log('🚀 TSD trigger: client="' + clientName + '", eVars=' + sdrData.evars.length + ', Events=' + sdrData.events.length);

        const { jobId } = await callN8nAndRegisterJob(webhookUrl,
            { clientName, sdrData, callbackUrl, jobId: existingJobId },
            { clientName, stage: 'tsd',
              steps: [
                { step: 1, name: 'trigger',  status: 'completed', updatedAt: now },
                { step: 2, name: 'tsd_ai',   status: 'active',    updatedAt: now },
                { step: 3, name: 'tsd_docx', status: 'pending',   updatedAt: null },
              ]
            }
        );

        res.json({ success: true, jobId, clientName, stage: 'tsd', message: 'TSD 생성이 시작되었습니다.' });
    } catch (err) {
        console.error('❌ /trigger/tsd error:', err.message || err);
        res.status(500).json({ error: err.message || String(err) });
    }
});

// ── /trigger/tags: sdrData JSON → Tags(Adobe Launch) 워크플로우 트리거 ────────────────────────────────
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
        const callbackUrl = 'http://' + CALLBACK_HOST + ':' + PORT + '/webhook/sdr-result';
        const now = new Date().toISOString();

        console.log('🚀 Tags trigger: client="' + clientName + '", eVars=' + sdrData.evars.length + ', Events=' + sdrData.events.length);

        const { jobId } = await callN8nAndRegisterJob(webhookUrl,
            { clientName, sdrData, callbackUrl, jobId: existingJobId },
            { clientName, stage: 'tags',
              steps: [
                { step: 1, name: 'trigger',     status: 'completed', updatedAt: now },
                { step: 2, name: 'tags_create',  status: 'active',    updatedAt: now },
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

src = src.slice(0, tStart) + newHandlers + src.slice(oldEnd);
console.log('✅ Replaced /trigger block + added /trigger/sdr, /trigger/tsd, /trigger/tags');

// ── 3. Update STEP_TRANSITIONS ────────────────────────────────────────────
const OLD_TRANS_CHECK = "'step_sdr_done':    { complete: 'sdr'";
const NEW_TRANS = `const STEP_TRANSITIONS = {
    // SDR stage
    'step_sdr_done':     { complete: 'sdr'                        },
    'step_excel_start':  {                  activate: 'excel'      },
    'step_excel_done':   { complete: 'excel'                       },
    // TSD stage
    'step_tsd_start':    {                  activate: 'tsd_ai'     },
    'step_tsd_done':     { complete: 'tsd_ai', activate: 'tsd_docx' },
    // Tags stage
    'step_tags_start':   {                  activate: 'tags_create' },
    'step_tags_done':    { complete: 'tags_create'                  },
    // Legacy
    'step_done_start':   {                  activate: 'done'       },
};`;

if (src.includes(OLD_TRANS_CHECK)) {
  const OLD_TRANS = `const STEP_TRANSITIONS = {\n    'step_sdr_done':    { complete: 'sdr'                },\n    'step_excel_start': {                 activate: 'excel' },\n    'step_excel_done':  { complete: 'excel'              },\n    'step_tsd_start':   {                 activate: 'tsd'   },\n    'step_tsd_done':    { complete: 'tsd'                },\n    'step_done_start':  {                 activate: 'done'  },\n};`;
  src = src.replace(OLD_TRANS, NEW_TRANS);
  console.log('✅ Updated STEP_TRANSITIONS');
} else {
  console.log('⏭  STEP_TRANSITIONS already updated');
}

fs.writeFileSync('server.js', src, 'utf8');
console.log('✅ server.js patched successfully');

