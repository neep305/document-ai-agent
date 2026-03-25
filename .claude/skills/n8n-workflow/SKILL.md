---
name: n8n-workflow
description: Create and design n8n automation workflows. Use this skill when users ask to build n8n workflows, create automation pipelines, connect APIs, transform data between services, or set up triggers and notifications. Specialised for Adobe Analytics document generation pipelines (BRD/SDR/TSD). Generates importable workflow JSON files with proper node connections and configurations.
---

# n8n Workflow Builder

Build production-ready n8n workflows with proper node configurations, connections, and data transformations.  
This skill has **two tracks**:

| Track | When to use |
|---|---|
| **A. Adobe Analytics Pipeline** | BRD→SDR, SDR→TSD, TSD→Go-Live, or any Adobe Analytics document generation |
| **B. General Automation** | Any other webhook, schedule, or API automation task |

---

## Quick Start

Generate a workflow JSON file that can be imported directly into n8n:

```json
{
  "name": "My Workflow",
  "nodes": [...],
  "connections": {...},
  "settings": { "executionOrder": "v1" }
}
```

Save the output to `n8n-cloud/v<version>/<WorkflowName>.json`.

---

## Track A – Adobe Analytics Document Generation Pipeline

### Standard Node Sequence

```
Webhook Trigger
    → Extract and Validate      (Code node – parse body, validate required fields)
    → Create Binary             (Code node – base64 → binary for Excel)
    → Read Requirements Sheet   (Spreadsheet File node – read BRD/SDR Excel rows)
    → Parse Requirements        (Code node – group by category, format as markdown)
    → AI Agent                  (OpenAI / @n8n/n8n-nodes-langchain.agent)
    → Parse AI Output           (Code node – extract structured JSON from AI response)
    → [Optional] Split & Upload (Google Drive upload or file write)
    → Respond to Webhook        (Return files as JSON or trigger download)
```

### AI Agent Node (OpenAI Chat Completion)

Use `@n8n/n8n-nodes-langchain.openAi` or the built-in **OpenAI** node for direct calls.  
Always request **JSON-only responses** with a strict schema to avoid parse errors.

```json
{
  "type": "@n8n/n8n-nodes-langchain.openAi",
  "typeVersion": 1,
  "parameters": {
    "resource": "chat",
    "operation": "message",
    "modelId": { "__rl": true, "mode": "list", "value": "gpt-4o" },
    "messages": {
      "values": [
        {
          "role": "system",
          "content": "You are an Adobe Analytics implementation expert. Respond ONLY with valid JSON."
        },
        {
          "role": "user",
          "content": "={{ $json.formattedRequirements }}"
        }
      ]
    },
    "options": { "temperature": 0.3, "maxTokens": 8000 }
  }
}
```

> **Rule**: Always use `temperature: 0.3` for document generation — higher values cause JSON parse failures.

### Adobe Analytics SDR Output Schema

When generating SDR documents, instruct the AI to return:

```json
{
  "evars": [
    {
      "requirementId": "REQ-001",
      "variableNumber": "eVar1",
      "variableName": "Page Name",
      "description": "Name of the current page",
      "valueFormat": "string",
      "exampleValue": "Home",
      "allocation": "Most Recent",
      "expiration": "visit"
    }
  ],
  "props": [...],
  "events": [
    {
      "requirementId": "REQ-002",
      "eventNumber": "event1",
      "eventName": "Custom Page View",
      "description": "Fires on every page load",
      "eventType": "counter"
    }
  ]
}
```

**Mandatory variables** (always include regardless of BRD):
- **eVars**: Pagename, Site Section, ECID
- **Props**: Pagename, Site Section, ECID
- **Events**: Custom Page View

### Adobe Analytics TSD Output Schema (3-file pattern, v0.7+)

Instruct the AI to return three outputs in one JSON object:

```json
{
  "javascript": "// Adobe Data Layer JS code...",
  "markdown": "# Technical Solution Design\n\n...",
  "launchPayload": {
    "property_info": { "name": "ClientName Web", "platform": "web" },
    "extensions": [{ "name": "adobe-alchemy", "settings": { "datastreamId": "..." } }],
    "rules": [...]
  }
}
```

**Launch Payload rule structure:**
```json
{
  "name": "Page View",
  "conditions": [{ "type": "url-contains", "value": "/" }],
  "actions": [
    {
      "type": "xdm-send",
      "settings": {
        "xdm": {
          "eventType": "web.webpagedetails.pageViews",
          "web": { "webPageDetails": { "name": "%dl.web.webPageDetails.name%" } }
        }
      }
    }
  ]
}
```

Data element reference format: `%dl.{path}%` (e.g., `%dl.event%`, `%dl.web.webPageDetails.name%`)

### Parse AI Output – Code Node Pattern

Always guard against malformed JSON by stripping markdown fences:

```javascript
const raw = $input.first().json.message?.content
         || $input.first().json.choices?.[0]?.message?.content
         || '';

// Strip ```json ... ``` fences if present
const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();

let parsed;
try {
  parsed = JSON.parse(cleaned);
} catch (e) {
  throw new Error('AI output is not valid JSON: ' + e.message + '\n\nRaw: ' + raw.slice(0, 500));
}

return [{ json: { clientName: $('Extract and Validate').first().json.clientName, output: parsed } }];
```

### Read BRD Excel Sheet – SpreadsheetFile Node

```json
{
  "type": "n8n-nodes-base.spreadsheetFile",
  "typeVersion": 2,
  "parameters": {
    "operation": "fromFile",
    "binaryPropertyName": "file",
    "options": {
      "headerRow": true,
      "range": "B6:E75",
      "sheetName": "={{ $json.baseSheetName }}"
    }
  }
}
```

### Webhook Trigger with File Upload (multipart pattern)

```json
{
  "type": "n8n-nodes-base.webhook",
  "typeVersion": 2,
  "parameters": {
    "httpMethod": "POST",
    "path": "generate-sdr",
    "responseMode": "responseNode",
    "options": {}
  },
  "webhookId": "generate-unique-uuid"
}
```

Frontend HTML form sends:
```javascript
const formData = new FormData();
formData.append('clientName', 'AcmeCorp');
formData.append('baseSheetName', 'BRD');
formData.append('file', excelFile);
```

### Google Drive Upload Pattern

Split multiple output files into individual items, then upload:

```javascript
// Split Files for Upload (Code node)
const data = $input.first().json;
const files = data.files; // { javascript: {...}, markdown: {...}, launchPayload: {...} }

return Object.entries(files).map(([key, file]) => ({
  json: { clientName: data.clientName, fileKey: key, filename: file.filename, type: file.type },
  binary: {
    file: {
      data: Buffer.from(file.content).toString('base64'),
      mimeType: file.type,
      fileName: file.filename
    }
  }
}));
```

### Output File Naming Convention

All generated files use timestamp prefix: `{ClientName}_{Type}_{YYYYMMDD_HHmmss}.{ext}`

```javascript
const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);
const jsFilename = `${clientName}_adobeDataLayer_${timestamp}.js`;
const mdFilename = `${clientName}_TSD_${timestamp}.md`;
const jsonFilename = `${clientName}_LaunchPayload_${timestamp}.json`;
```

---

## Track B – General Automation

### Core Workflow Structure

```json
{
  "name": "My Workflow",
  "nodes": [...],
  "connections": {...},
  "settings": { "executionOrder": "v1" }
}
```

### Node Structure

```json
{
  "id": "unique-uuid",
  "name": "Node Display Name",
  "type": "n8n-nodes-base.nodetype",
  "typeVersion": 1,
  "position": [x, y],
  "parameters": {}
}
```

### Connection Structure

```json
{
  "Source Node Name": {
    "main": [[{ "node": "Target Node Name", "type": "main", "index": 0 }]]
  }
}
```

### Node Positioning

- Horizontal spacing: **250px** between sequential nodes
- Vertical spacing: **150px** for parallel branches
- Start position: `[250, 300]`

### Common Node Patterns

**HTTP Request**
```json
{
  "type": "n8n-nodes-base.httpRequest",
  "parameters": {
    "method": "GET",
    "url": "https://api.example.com/data",
    "authentication": "predefinedCredentialType",
    "nodeCredentialType": "httpHeaderAuth",
    "options": {}
  }
}
```

**Schedule Trigger**
```json
{
  "type": "n8n-nodes-base.scheduleTrigger",
  "parameters": {
    "rule": { "interval": [{ "field": "hours", "hoursInterval": 1 }] }
  }
}
```

**Data Transformation (Code Node)**
```json
{
  "type": "n8n-nodes-base.code",
  "parameters": {
    "jsCode": "return items.map(item => ({ json: { ...item.json, processed: true } }));"
  }
}
```

**Conditional Routing (If Node)**
```json
{
  "type": "n8n-nodes-base.if",
  "parameters": {
    "conditions": {
      "conditions": [
        {
          "leftValue": "={{ $json.status }}",
          "rightValue": "success",
          "operator": { "type": "string", "operation": "equals" }
        }
      ],
      "combinator": "and"
    }
  }
}
```

---

## Workflow Generation Process

1. Identify the **trigger** (webhook, schedule, manual, app-specific)
2. Determine the **track** (Adobe Analytics pipeline vs general)
3. Map the **data flow** and required transformations
4. Select appropriate **nodes** for each step (see references)
5. Configure **node parameters** including credentials
6. Define **connections** between nodes
7. Add **error handling** (Error Trigger node for critical paths)
8. Generate the complete **JSON** and save to `n8n-cloud/v<version>/`

---

## Best Practices

1. **Descriptive node names** – Makes debugging easier (e.g., "Parse Requirements" not "Code")
2. **JSON-only AI responses** – Enforce with system prompt; always strip markdown fences before parsing
3. **temperature: 0.3** – Required for structured document generation
4. **Validate inputs early** – Use a "Extract and Validate" Code node right after webhook
5. **Add sticky notes** – Document complex logic inline in the workflow JSON
6. **Never hardcode secrets** – Use n8n Credentials for API keys
7. **`responseMode: responseNode`** – Use when sending files back to the client
8. **Timestamp filenames** – Prevents collisions: `YYYYMMDD_HHmmss` prefix

---

## Reference Files

- **[references/nodes.md](references/nodes.md)**: Complete list of common n8n nodes with parameters
- **[references/integrations.md](references/integrations.md)**: Popular service integrations (Slack, Google Drive, etc.)

## Template Workflows

See `assets/templates/` for ready-to-use workflow templates:
- `webhook-to-slack.json` – Webhook trigger to Slack notification
- `schedule-api-sync.json` – Scheduled API data sync
- `data-transform-pipeline.json` – Multi-step data transformation

## Output Format

Save workflow JSON to a file importable into n8n via:
- **n8n UI**: Settings → Import from File
- **n8n CLI**: `n8n import:workflow --input=workflow.json`
