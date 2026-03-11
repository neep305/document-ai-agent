# Adobe Excel Service

Excel generation microservice for BRD to SDR workflow. This service solves n8n 2.0.3 ExcelJS compatibility issues by running as a standalone Node.js server.

## Features

- ✅ Generates Excel files from SDR data (eVars, Props, Events)
- ✅ Preserves Excel template formatting using ExcelJS
- ✅ RESTful API for easy integration
- ✅ Web UI for manual testing
- ✅ Docker support for production deployment
- ✅ Configurable sheet names via environment variables

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- (Optional) Docker for containerized deployment

### Installation

```bash
# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Edit .env with your n8n webhook URL
```

### Run Locally

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

Server runs on `http://localhost:3000`

## Configuration

### Environment Variables

Create a `.env` file from `.env.example`:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | Environment (development/production) |
| `N8N_WEBHOOK_URL` | (required) | n8n webhook endpoint URL |
| `SHEET_NAME_EVARS` | `eVars` | Excel sheet name for eVars |
| `SHEET_NAME_PROPS` | `props` | Excel sheet name for Props |
| `SHEET_NAME_EVENTS` | `custom events (metrics)` | Excel sheet name for Events |

### n8n Webhook URL

Get your webhook URL from n8n workflow:
1. Open n8n workflow: **BRD to SDR with TSD GoogleDrive - v0.6**
2. Find the **Webhook Trigger** node
3. Copy the webhook URL (format: `http://localhost:5678/webhook/<webhook-id>`)
4. Update `N8N_WEBHOOK_URL` in `.env`

Example:
```env
N8N_WEBHOOK_URL=http://localhost:5678/webhook/22ad9668-47fd-4d5c-9cf7-69d72aa838e1
```

## API Reference

### POST `/generate-excel`

Generates an Excel file from SDR data.

**Request Body:**
```json
{
  "clientName": "Client A",
  "originalFileBase64": "UEsDBBQAB...",
  "sdr": {
    "evars": [...],
    "props": [...],
    "events": [...]
  }
}
```

**Response:**
- Content-Type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- Downloads Excel file: `{clientName}_SDR_{timestamp}.xlsx`

### GET `/health`

Health check endpoint for Docker/monitoring.

**Response:**
```json
{
  "status": "ok",
  "service": "excel-generator",
  "version": "0.5.0",
  "uptime": 123.45
}
```

## Integration with n8n

### Data Flow

```
HTML Form → n8n Webhook → AI Processing → JSON Response
    ↓
webhook-service /generate-excel → Excel File Download
```

### n8n Workflow Setup

Required workflow: **BRD to SDR with TSD GoogleDrive - v0.6**

Key nodes:
1. **Webhook Trigger** - Receives Excel upload
2. **SDR Agent** - AI generates eVars/Props/Events
3. **Respond with JSON** - Returns SDR data to frontend
4. Frontend calls webhook-service to generate Excel

### Data Contract

**n8n Response Format:**
```json
{
  "success": true,
  "clientName": "...",
  "originalFileBase64": "...",
  "sdr": {
    "evars": [...],
    "props": [...],
    "events": [...]
  }
}
```

## Docker Deployment

```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

## File Structure

```
webhook-service/
├── server.js              # Main Express server
├── package.json           # Dependencies
├── Dockerfile             # Docker image
├── docker-compose.yml     # Docker Compose config
├── .env                   # Environment variables (gitignored)
├── .env.example           # Environment template
├── public/
│   └── index.html         # Web UI
├── input/                 # Sample files
└── output/                # Generated files
```

## Troubleshooting

### "Sheet not found in workbook"

Update `.env` with correct sheet names from your template:
```env
SHEET_NAME_EVARS=Your eVar Sheet Name
```

### "Cannot connect to n8n webhook"

1. Verify n8n is running: `http://localhost:5678`
2. Check webhook URL in n8n workflow
3. Update `.env` with correct URL
4. Restart service

### Docker build fails

Ensure `docker-compose.yml` has `context: .` (not `./excel-service`)

## Architecture

This project has **two independent systems**:

1. **Python LangGraph** (`src/`, `run_sample.py`)
   - Programmatic document generation
   - Output: Markdown/JSON files

2. **n8n + webhook-service** (this folder)
   - Web-based UI for business users
   - Output: Excel files with formatting

**No integration between systems** - different use cases.

### Why Separate Service?

n8n 2.0.3 blocks `require()` in Code nodes, preventing ExcelJS from running. This standalone service solves that limitation.

## Maintenance

### File Cleanup

Output folder accumulates files. Recommended cleanup:

```bash
# Delete files older than 7 days
find ./output -type f -mtime +7 -delete
```

## Security (Production)

Current: Development mode (no auth, no rate limiting)

For production, add:
- API key authentication
- Rate limiting (express-rate-limit)
- CORS whitelist
- Input validation
- HTTPS/TLS

## Support

Refer to:
- Main docs: `/base-docs/PROJECT.md`
- n8n guide: `/n8n-cloud/v0.6/GOOGLE_DRIVE_SETUP.md`
