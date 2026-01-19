# Adobe Excel Service v0.5

Node.js + ExcelJS based BRD to SDR Excel generator

## Architecture

- **Frontend**: Single-page HTML (served by Express)
- **Backend**: Express.js + ExcelJS
- **Integration**: n8n webhook for AI processing

## Local Development

```bash
npm install
npm run dev
# Open http://localhost:3000
```

## Docker Build

```bash
docker build -t adobe-excel-service:0.5 .
docker run -p 3000:3000 adobe-excel-service:0.5
```

## API Endpoints

- `GET /` - Web UI
- `POST /generate-excel` - Excel generation API
- `GET /health` - Health check

## Requirements

- Node.js 18+
- ExcelJS 4.4+
