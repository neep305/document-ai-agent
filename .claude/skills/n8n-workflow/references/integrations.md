# n8n Service Integrations

## Table of Contents
- [Communication](#communication)
- [Google Services](#google-services)
- [Database](#database)
- [Cloud Storage](#cloud-storage)
- [CRM & Marketing](#crm--marketing)
- [Project Management](#project-management)

---

## Communication

### Slack

**Send Message**
```json
{
  "type": "n8n-nodes-base.slack",
  "typeVersion": 2.2,
  "parameters": {
    "resource": "message",
    "operation": "post",
    "channel": { "mode": "id", "value": "C01234567" },
    "messageType": "text",
    "text": "={{ $json.message }}"
  },
  "credentials": { "slackApi": { "id": "credential-id", "name": "Slack" } }
}
```

**Send with Blocks**
```json
{
  "parameters": {
    "resource": "message",
    "operation": "post",
    "channel": { "mode": "id", "value": "C01234567" },
    "messageType": "block",
    "blocksUi": {
      "blocksValues": [
        {
          "type": "section",
          "text": { "type": "mrkdwn", "text": "*Alert*\n{{ $json.alertMessage }}" }
        }
      ]
    }
  }
}
```

### Discord

**Send Message**
```json
{
  "type": "n8n-nodes-base.discord",
  "typeVersion": 2,
  "parameters": {
    "resource": "message",
    "operation": "send",
    "channelId": "={{ $json.channelId }}",
    "content": "={{ $json.message }}"
  },
  "credentials": { "discordBotApi": { "id": "credential-id", "name": "Discord Bot" } }
}
```

### Email (SMTP)

**Send Email**
```json
{
  "type": "n8n-nodes-base.emailSend",
  "typeVersion": 2.1,
  "parameters": {
    "fromEmail": "sender@example.com",
    "toEmail": "={{ $json.recipientEmail }}",
    "subject": "={{ $json.subject }}",
    "emailType": "text",
    "message": "={{ $json.body }}"
  },
  "credentials": { "smtp": { "id": "credential-id", "name": "SMTP" } }
}
```

### Microsoft Teams

**Send Message**
```json
{
  "type": "n8n-nodes-base.microsoftTeams",
  "typeVersion": 2,
  "parameters": {
    "resource": "chatMessage",
    "operation": "create",
    "teamId": "={{ $json.teamId }}",
    "channelId": "={{ $json.channelId }}",
    "messageType": "text",
    "message": "={{ $json.message }}"
  },
  "credentials": { "microsoftTeamsOAuth2Api": { "id": "credential-id", "name": "Microsoft Teams" } }
}
```

---

## Google Services

### Google Sheets

**Append Row**
```json
{
  "type": "n8n-nodes-base.googleSheets",
  "typeVersion": 4.5,
  "parameters": {
    "operation": "append",
    "documentId": { "mode": "list", "value": "spreadsheet-id" },
    "sheetName": { "mode": "list", "value": "Sheet1" },
    "columns": {
      "mappingMode": "autoMapInputData",
      "value": {}
    },
    "options": {}
  },
  "credentials": { "googleSheetsOAuth2Api": { "id": "credential-id", "name": "Google Sheets" } }
}
```

**Read Rows**
```json
{
  "parameters": {
    "operation": "read",
    "documentId": { "mode": "list", "value": "spreadsheet-id" },
    "sheetName": { "mode": "list", "value": "Sheet1" },
    "options": { "dataLocationOnSheet": { "rangeDefinition": "detectAutomatically" } }
  }
}
```

### Google Drive

**Upload File**
```json
{
  "type": "n8n-nodes-base.googleDrive",
  "typeVersion": 3,
  "parameters": {
    "operation": "upload",
    "name": "={{ $json.fileName }}",
    "folderId": { "mode": "id", "value": "folder-id" },
    "inputDataFieldName": "data"
  },
  "credentials": { "googleDriveOAuth2Api": { "id": "credential-id", "name": "Google Drive" } }
}
```

### Gmail

**Send Email**
```json
{
  "type": "n8n-nodes-base.gmail",
  "typeVersion": 2.1,
  "parameters": {
    "resource": "message",
    "operation": "send",
    "sendTo": "={{ $json.to }}",
    "subject": "={{ $json.subject }}",
    "emailType": "text",
    "message": "={{ $json.body }}"
  },
  "credentials": { "gmailOAuth2": { "id": "credential-id", "name": "Gmail" } }
}
```

### Google Calendar

**Create Event**
```json
{
  "type": "n8n-nodes-base.googleCalendar",
  "typeVersion": 1,
  "parameters": {
    "operation": "create",
    "calendar": { "mode": "id", "value": "primary" },
    "start": "={{ $json.startTime }}",
    "end": "={{ $json.endTime }}",
    "summary": "={{ $json.title }}",
    "additionalFields": {
      "description": "={{ $json.description }}"
    }
  },
  "credentials": { "googleCalendarOAuth2Api": { "id": "credential-id", "name": "Google Calendar" } }
}
```

---

## Database

### MySQL

**Query**
```json
{
  "type": "n8n-nodes-base.mySql",
  "typeVersion": 2.4,
  "parameters": {
    "operation": "executeQuery",
    "query": "SELECT * FROM users WHERE status = 'active' LIMIT 100"
  },
  "credentials": { "mySql": { "id": "credential-id", "name": "MySQL" } }
}
```

**Insert**
```json
{
  "parameters": {
    "operation": "insert",
    "table": { "mode": "name", "value": "users" },
    "columns": {
      "mappingMode": "autoMapInputData",
      "value": {}
    }
  }
}
```

### PostgreSQL

**Query**
```json
{
  "type": "n8n-nodes-base.postgres",
  "typeVersion": 2.5,
  "parameters": {
    "operation": "executeQuery",
    "query": "SELECT * FROM orders WHERE created_at > NOW() - INTERVAL '24 hours'"
  },
  "credentials": { "postgres": { "id": "credential-id", "name": "PostgreSQL" } }
}
```

### MongoDB

**Find Documents**
```json
{
  "type": "n8n-nodes-base.mongoDb",
  "typeVersion": 1.1,
  "parameters": {
    "operation": "find",
    "collection": "users",
    "query": "{ \"status\": \"active\" }",
    "options": { "limit": 100 }
  },
  "credentials": { "mongoDb": { "id": "credential-id", "name": "MongoDB" } }
}
```

### Redis

**Get/Set**
```json
{
  "type": "n8n-nodes-base.redis",
  "typeVersion": 1,
  "parameters": {
    "operation": "set",
    "key": "={{ $json.cacheKey }}",
    "value": "={{ JSON.stringify($json.data) }}",
    "expire": true,
    "ttl": 3600
  },
  "credentials": { "redis": { "id": "credential-id", "name": "Redis" } }
}
```

---

## Cloud Storage

### AWS S3

**Upload File**
```json
{
  "type": "n8n-nodes-base.s3",
  "typeVersion": 1,
  "parameters": {
    "operation": "upload",
    "bucketName": "my-bucket",
    "fileName": "={{ $json.fileName }}",
    "binaryPropertyName": "data"
  },
  "credentials": { "aws": { "id": "credential-id", "name": "AWS" } }
}
```

**Download File**
```json
{
  "parameters": {
    "operation": "download",
    "bucketName": "my-bucket",
    "fileKey": "={{ $json.fileKey }}"
  }
}
```

### Dropbox

**Upload File**
```json
{
  "type": "n8n-nodes-base.dropbox",
  "typeVersion": 1,
  "parameters": {
    "operation": "upload",
    "path": "/uploads/{{ $json.fileName }}",
    "binaryPropertyName": "data"
  },
  "credentials": { "dropboxApi": { "id": "credential-id", "name": "Dropbox" } }
}
```

---

## CRM & Marketing

### HubSpot

**Create Contact**
```json
{
  "type": "n8n-nodes-base.hubspot",
  "typeVersion": 2,
  "parameters": {
    "resource": "contact",
    "operation": "create",
    "additionalFields": {
      "email": "={{ $json.email }}",
      "firstName": "={{ $json.firstName }}",
      "lastName": "={{ $json.lastName }}"
    }
  },
  "credentials": { "hubspotApi": { "id": "credential-id", "name": "HubSpot" } }
}
```

### Salesforce

**Create Record**
```json
{
  "type": "n8n-nodes-base.salesforce",
  "typeVersion": 1,
  "parameters": {
    "resource": "lead",
    "operation": "create",
    "additionalFields": {
      "company": "={{ $json.company }}",
      "email": "={{ $json.email }}",
      "lastName": "={{ $json.lastName }}"
    }
  },
  "credentials": { "salesforceOAuth2Api": { "id": "credential-id", "name": "Salesforce" } }
}
```

### Mailchimp

**Add Subscriber**
```json
{
  "type": "n8n-nodes-base.mailchimp",
  "typeVersion": 1,
  "parameters": {
    "resource": "listMember",
    "operation": "create",
    "list": { "mode": "id", "value": "list-id" },
    "email": "={{ $json.email }}",
    "status": "subscribed"
  },
  "credentials": { "mailchimpApi": { "id": "credential-id", "name": "Mailchimp" } }
}
```

---

## Project Management

### Notion

**Create Page**
```json
{
  "type": "n8n-nodes-base.notion",
  "typeVersion": 2.2,
  "parameters": {
    "resource": "page",
    "operation": "create",
    "databaseId": { "mode": "id", "value": "database-id" },
    "propertiesUi": {
      "propertyValues": [
        { "key": "Name", "title": "={{ $json.title }}" },
        { "key": "Status", "selectValue": "In Progress" }
      ]
    }
  },
  "credentials": { "notionApi": { "id": "credential-id", "name": "Notion" } }
}
```

### Jira

**Create Issue**
```json
{
  "type": "n8n-nodes-base.jira",
  "typeVersion": 1,
  "parameters": {
    "resource": "issue",
    "operation": "create",
    "project": "PROJECT-KEY",
    "issueType": "Task",
    "summary": "={{ $json.title }}",
    "additionalFields": {
      "description": "={{ $json.description }}"
    }
  },
  "credentials": { "jiraSoftwareCloudApi": { "id": "credential-id", "name": "Jira" } }
}
```

### Trello

**Create Card**
```json
{
  "type": "n8n-nodes-base.trello",
  "typeVersion": 1,
  "parameters": {
    "resource": "card",
    "operation": "create",
    "listId": "list-id",
    "name": "={{ $json.title }}",
    "additionalFields": {
      "description": "={{ $json.description }}"
    }
  },
  "credentials": { "trelloApi": { "id": "credential-id", "name": "Trello" } }
}
```

### Asana

**Create Task**
```json
{
  "type": "n8n-nodes-base.asana",
  "typeVersion": 1,
  "parameters": {
    "resource": "task",
    "operation": "create",
    "workspaceId": "workspace-id",
    "name": "={{ $json.taskName }}",
    "additionalFields": {
      "projectIds": ["project-id"],
      "notes": "={{ $json.description }}"
    }
  },
  "credentials": { "asanaApi": { "id": "credential-id", "name": "Asana" } }
}
```

### Linear

**Create Issue**
```json
{
  "type": "n8n-nodes-base.linear",
  "typeVersion": 1,
  "parameters": {
    "resource": "issue",
    "operation": "create",
    "teamId": "team-id",
    "title": "={{ $json.title }}",
    "additionalFields": {
      "description": "={{ $json.description }}"
    }
  },
  "credentials": { "linearApi": { "id": "credential-id", "name": "Linear" } }
}
```

---

## Credential Configuration Note

All credential IDs shown as `"credential-id"` should be replaced with actual n8n credential IDs after importing the workflow. Credentials are configured in n8n's credential manager and referenced by their unique IDs.
