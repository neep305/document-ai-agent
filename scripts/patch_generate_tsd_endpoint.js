#!/usr/bin/env node
/**
 * patch_generate_tsd_endpoint.js
 * Adds ?format=json support to the /generate-tsd endpoint in webhook-service/server.js
 * so that n8n HTTP Request nodes can call it directly without require('docx').
 */
'use strict';

const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '..', 'webhook-service', 'server.js');
let content = fs.readFileSync(serverPath, 'utf8');

// Find the /generate-tsd endpoint start
const endpointStart = content.indexOf("app.post('/generate-tsd',");
if (endpointStart === -1) {
  console.error('ERROR: Could not find /generate-tsd endpoint in server.js');
  process.exit(1);
}

// Find the closing }); of this endpoint (the one that closes app.post)
// We search for the pattern after the endpoint start
const afterStart = content.indexOf('\napp.', endpointStart + 1);
if (afterStart === -1) {
  console.error('ERROR: Could not find end of /generate-tsd endpoint');
  process.exit(1);
}

const oldEndpoint = content.slice(endpointStart, afterStart);

// Check if already patched
if (oldEndpoint.includes('format=json') || oldEndpoint.includes("req.query.format")) {
  console.log('✅ /generate-tsd endpoint already patched — skipping.');
  process.exit(0);
}

// Build the new endpoint
const newEndpoint = `app.post('/generate-tsd', async (req, res) => {
    try {
        const { clientName, markdown, javascript } = req.body;
        const format = req.query.format; // 'json' → returns base64 JSON; default → binary DOCX

        if (!clientName || !markdown) {
            return res.status(400).json({ error: 'Missing required fields: clientName, markdown' });
        }

        console.log(\`📄 Generating TSD .docx for "\${clientName}"...\`);

        const result = await spawnPython('generate_tsd.js', { clientName, markdown, javascript: javascript || '' }, 'node');
        if (!result.success) throw new Error(result.error || 'generate_tsd.js returned failure');

        const outputBuffer = Buffer.from(result.base64, 'base64');

        const now = new Date();
        const timestamp = now.toISOString()
            .replace(/T/, '_').replace(/:/g, '').replace(/\\.\\d+Z$/, '').substring(0, 15);
        const safeClientName = clientName.replace(/[^a-zA-Z0-9]/g, '_');
        const filename = \`TSD_\${safeClientName}_\${timestamp}.docx\`;

        const outputDir = path.join(__dirname, 'output');
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
        fs.writeFileSync(path.join(outputDir, filename), outputBuffer);
        console.log(\`   ✅ TSD .docx generated: \${filename} (\${(outputBuffer.length / 1024).toFixed(1)} KB, \${result.sectionCount} sections)\`);

        // JSON response for n8n HTTP Request node (avoids require('docx') restriction in Code nodes)
        if (format === 'json') {
            return res.json({
                success: true,
                base64: result.base64,
                filename,
                mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                sectionCount: result.sectionCount || 0,
            });
        }

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', \`attachment; filename="\${filename}"\`);
        res.send(outputBuffer);
    } catch (error) {
        console.error('❌ Error generating TSD:', error);
        res.status(500).json({ error: error.message });
    }
});`;

const newContent = content.slice(0, endpointStart) + newEndpoint + content.slice(afterStart);

// Backup original
fs.writeFileSync(serverPath + '.bak', content, 'utf8');
console.log('📦 Backup written to server.js.bak');

fs.writeFileSync(serverPath, newContent, 'utf8');
console.log('✅ /generate-tsd endpoint patched with ?format=json support.');
