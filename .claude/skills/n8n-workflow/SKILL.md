---
name: n8n-workflow
description: Create and design n8n automation workflows. Use this skill when users ask to build n8n workflows, create automation pipelines, connect APIs, transform data between services, or set up triggers and notifications. Generates importable workflow JSON files with proper node connections and configurations.
---

# n8n Workflow Builder

Build production-ready n8n workflows with proper node configurations, connections, and data transformations.

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

## Workflow Structure

Every n8n workflow JSON contains:

1. **name**: Workflow name
2. **nodes**: Array of node configurations
3. **connections**: Object defining data flow between nodes
4. **settings**: Execution settings

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
    "main": [
      [
        {
          "node": "Target Node Name",
          "type": "main",
          "index": 0
        }
      ]
    ]
  }
}
```

## Node Positioning

Place nodes on a grid for readability:
- Horizontal spacing: 250px between nodes
- Vertical spacing: 150px for parallel branches
- Start position: [250, 300]

## Common Patterns

### 1. API Request Pattern

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

### 2. Webhook Trigger Pattern

```json
{
  "type": "n8n-nodes-base.webhook",
  "parameters": {
    "httpMethod": "POST",
    "path": "webhook-path",
    "responseMode": "onReceived"
  },
  "webhookId": "unique-webhook-id"
}
```

### 3. Schedule Trigger Pattern

```json
{
  "type": "n8n-nodes-base.scheduleTrigger",
  "parameters": {
    "rule": {
      "interval": [{ "field": "hours", "hoursInterval": 1 }]
    }
  }
}
```

### 4. Data Transformation (Code Node)

```json
{
  "type": "n8n-nodes-base.code",
  "parameters": {
    "jsCode": "return items.map(item => ({ json: { ...item.json, processed: true } }));"
  }
}
```

### 5. Conditional Routing (If Node)

```json
{
  "type": "n8n-nodes-base.if",
  "parameters": {
    "conditions": {
      "options": { "caseSensitive": true, "leftValue": "", "typeValidation": "strict" },
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

## Reference Files

- **[references/nodes.md](references/nodes.md)**: Complete list of common n8n nodes with parameters
- **[references/integrations.md](references/integrations.md)**: Popular service integrations (Slack, Google, etc.)

## Template Workflows

See `assets/templates/` for ready-to-use workflow templates:
- `webhook-to-slack.json` - Webhook trigger to Slack notification
- `schedule-api-sync.json` - Scheduled API data sync
- `data-transform-pipeline.json` - Multi-step data transformation

## Workflow Generation Process

1. Identify the trigger (webhook, schedule, manual, or app-specific)
2. Map out the data flow and transformations needed
3. Select appropriate nodes for each step
4. Configure node parameters
5. Define connections between nodes
6. Set proper error handling (optional Error Trigger node)
7. Generate the complete JSON

## Best Practices

1. **Use descriptive node names** - Makes debugging easier
2. **Add sticky notes** - Document complex logic
3. **Handle errors** - Add Error Trigger for critical workflows
4. **Test incrementally** - Verify each node before connecting
5. **Use expressions wisely** - `{{ $json.field }}` for data access
6. **Credential security** - Never hardcode secrets in workflows

## Output Format

Always output workflow JSON to a `.json` file that can be directly imported into n8n via:
- n8n UI: Settings > Import from File
- n8n CLI: `n8n import:workflow --input=workflow.json`
