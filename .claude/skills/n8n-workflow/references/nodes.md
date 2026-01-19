# n8n Node Reference

## Table of Contents
- [Trigger Nodes](#trigger-nodes)
- [Core Nodes](#core-nodes)
- [Data Transformation](#data-transformation)
- [Flow Control](#flow-control)
- [Utility Nodes](#utility-nodes)

---

## Trigger Nodes

### Manual Trigger
```json
{
  "type": "n8n-nodes-base.manualTrigger",
  "typeVersion": 1,
  "parameters": {}
}
```

### Webhook
```json
{
  "type": "n8n-nodes-base.webhook",
  "typeVersion": 2,
  "parameters": {
    "httpMethod": "POST",
    "path": "my-webhook",
    "responseMode": "onReceived",
    "responseData": "allEntries"
  },
  "webhookId": "generate-unique-uuid"
}
```

### Schedule Trigger
```json
{
  "type": "n8n-nodes-base.scheduleTrigger",
  "typeVersion": 1.2,
  "parameters": {
    "rule": {
      "interval": [
        { "field": "minutes", "minutesInterval": 30 }
      ]
    }
  }
}
```

Interval options:
- `seconds` / `secondsInterval`
- `minutes` / `minutesInterval`
- `hours` / `hoursInterval`
- `days` / `daysInterval`
- `weeks` / `weeksInterval`
- `months` / `monthsInterval`

### Cron Trigger
```json
{
  "type": "n8n-nodes-base.scheduleTrigger",
  "parameters": {
    "rule": {
      "interval": [
        { "field": "cronExpression", "expression": "0 9 * * 1-5" }
      ]
    }
  }
}
```

---

## Core Nodes

### HTTP Request
```json
{
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "parameters": {
    "method": "GET",
    "url": "https://api.example.com/endpoint",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        { "name": "Authorization", "value": "Bearer {{ $credentials.apiKey }}" }
      ]
    },
    "sendQuery": true,
    "queryParameters": {
      "parameters": [
        { "name": "limit", "value": "100" }
      ]
    },
    "sendBody": true,
    "bodyParameters": {
      "parameters": [
        { "name": "data", "value": "={{ $json.inputData }}" }
      ]
    },
    "options": {
      "response": { "response": { "responseFormat": "json" } }
    }
  }
}
```

Methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`

### Set Node
```json
{
  "type": "n8n-nodes-base.set",
  "typeVersion": 3.4,
  "parameters": {
    "mode": "manual",
    "duplicateItem": false,
    "assignments": {
      "assignments": [
        { "id": "uuid", "name": "fieldName", "value": "={{ $json.sourceField }}", "type": "string" }
      ]
    },
    "options": {}
  }
}
```

Types: `string`, `number`, `boolean`, `array`, `object`

### Code Node (JavaScript)
```json
{
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "parameters": {
    "jsCode": "// Process all items\nreturn items.map(item => {\n  return {\n    json: {\n      ...item.json,\n      processed: true,\n      timestamp: new Date().toISOString()\n    }\n  };\n});"
  }
}
```

### Code Node (Python)
```json
{
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "parameters": {
    "mode": "runOnceForAllItems",
    "language": "python",
    "pythonCode": "# Process items\nfor item in _input.all():\n    item.json['processed'] = True\nreturn _input.all()"
  }
}
```

---

## Data Transformation

### Split Out (Array to Items)
```json
{
  "type": "n8n-nodes-base.splitOut",
  "typeVersion": 1,
  "parameters": {
    "fieldToSplitOut": "data.items",
    "options": {}
  }
}
```

### Aggregate (Items to Array)
```json
{
  "type": "n8n-nodes-base.aggregate",
  "typeVersion": 1,
  "parameters": {
    "aggregate": "aggregateAllItemData",
    "options": {}
  }
}
```

### Merge Node
```json
{
  "type": "n8n-nodes-base.merge",
  "typeVersion": 3,
  "parameters": {
    "mode": "combine",
    "combineBy": "combineByPosition",
    "options": {}
  }
}
```

Modes:
- `append` - Combine inputs sequentially
- `combine` - Merge by position or key
- `chooseBranch` - Select one input

### Filter Node
```json
{
  "type": "n8n-nodes-base.filter",
  "typeVersion": 2,
  "parameters": {
    "conditions": {
      "options": { "caseSensitive": true, "leftValue": "", "typeValidation": "strict" },
      "conditions": [
        {
          "leftValue": "={{ $json.status }}",
          "rightValue": "active",
          "operator": { "type": "string", "operation": "equals" }
        }
      ],
      "combinator": "and"
    },
    "options": {}
  }
}
```

### Sort Node
```json
{
  "type": "n8n-nodes-base.sort",
  "typeVersion": 1,
  "parameters": {
    "sortFieldsUi": {
      "sortField": [
        { "fieldName": "createdAt", "order": "descending" }
      ]
    },
    "options": {}
  }
}
```

### Limit Node
```json
{
  "type": "n8n-nodes-base.limit",
  "typeVersion": 1,
  "parameters": {
    "maxItems": 10,
    "options": {}
  }
}
```

### Remove Duplicates
```json
{
  "type": "n8n-nodes-base.removeDuplicates",
  "typeVersion": 1,
  "parameters": {
    "operation": "removeDuplicatesByField",
    "fieldsToCompare": "id",
    "options": {}
  }
}
```

---

## Flow Control

### If Node (Conditional)
```json
{
  "type": "n8n-nodes-base.if",
  "typeVersion": 2,
  "parameters": {
    "conditions": {
      "options": { "caseSensitive": true, "leftValue": "", "typeValidation": "strict" },
      "conditions": [
        {
          "leftValue": "={{ $json.value }}",
          "rightValue": "100",
          "operator": { "type": "number", "operation": "gt" }
        }
      ],
      "combinator": "and"
    },
    "options": {}
  }
}
```

Operators by type:
- **string**: `equals`, `notEquals`, `contains`, `notContains`, `startsWith`, `endsWith`, `regex`
- **number**: `equals`, `notEquals`, `gt`, `gte`, `lt`, `lte`
- **boolean**: `true`, `false`
- **dateTime**: `after`, `before`
- **object/array**: `exists`, `notExists`, `empty`, `notEmpty`

### Switch Node
```json
{
  "type": "n8n-nodes-base.switch",
  "typeVersion": 3,
  "parameters": {
    "mode": "rules",
    "rules": {
      "values": [
        {
          "outputKey": "success",
          "conditions": {
            "conditions": [
              {
                "leftValue": "={{ $json.status }}",
                "rightValue": "success",
                "operator": { "type": "string", "operation": "equals" }
              }
            ]
          }
        },
        {
          "outputKey": "error",
          "conditions": {
            "conditions": [
              {
                "leftValue": "={{ $json.status }}",
                "rightValue": "error",
                "operator": { "type": "string", "operation": "equals" }
              }
            ]
          }
        }
      ]
    },
    "options": { "fallbackOutput": "extra" }
  }
}
```

### Loop Over Items
```json
{
  "type": "n8n-nodes-base.splitInBatches",
  "typeVersion": 3,
  "parameters": {
    "batchSize": 10,
    "options": {}
  }
}
```

### Wait Node
```json
{
  "type": "n8n-nodes-base.wait",
  "typeVersion": 1.1,
  "parameters": {
    "amount": 5,
    "unit": "seconds"
  }
}
```

Units: `seconds`, `minutes`, `hours`, `days`

---

## Utility Nodes

### Sticky Note
```json
{
  "type": "n8n-nodes-base.stickyNote",
  "typeVersion": 1,
  "parameters": {
    "content": "## Note Title\n\nDescription of this workflow section."
  }
}
```

### No Operation (NoOp)
```json
{
  "type": "n8n-nodes-base.noOp",
  "typeVersion": 1,
  "parameters": {}
}
```

### Error Trigger
```json
{
  "type": "n8n-nodes-base.errorTrigger",
  "typeVersion": 1,
  "parameters": {}
}
```

### Stop and Error
```json
{
  "type": "n8n-nodes-base.stopAndError",
  "typeVersion": 1,
  "parameters": {
    "errorType": "errorMessage",
    "errorMessage": "Custom error message"
  }
}
```

### Execute Workflow
```json
{
  "type": "n8n-nodes-base.executeWorkflow",
  "typeVersion": 1,
  "parameters": {
    "source": "database",
    "workflowId": "workflow-id-here"
  }
}
```

---

## Expression Syntax

Access data using n8n expressions:

| Expression | Description |
|------------|-------------|
| `{{ $json.field }}` | Current item's field |
| `{{ $json['field name'] }}` | Field with spaces |
| `{{ $('Node Name').item.json.field }}` | Field from specific node |
| `{{ $input.first().json.field }}` | First item from input |
| `{{ $input.all() }}` | All input items |
| `{{ $now }}` | Current datetime |
| `{{ $today }}` | Current date |
| `{{ $execution.id }}` | Current execution ID |
| `{{ $workflow.name }}` | Workflow name |
| `{{ $vars.myVar }}` | Environment variable |
