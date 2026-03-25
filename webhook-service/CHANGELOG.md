# Changelog - webhook-service

All notable changes to the webhook-service will be documented in this file.

## [0.8.0] - 2026-03-18

### Changed
- **UI**: Version badge updated to `v0.8.0` (title, header badge, startup log)
- **Health endpoint**: Added `n8nCompatibility: 'v0.8'` field to `/health` response
- **Stats display**: Added `OOTB Variables` count to success message (maps to `stats.ootb` from n8n v0.8 response)
- **Compatibility panel**: Added visual n8n version compatibility panel to UI
  - ✅ n8n v0.8 (current) — `section_a_ootb`, `data_layer_map`, `brd_traceability` fields
  - ✅ n8n v0.7 / v0.6 / v0.5 — backward compatible
  - ❌ n8n v0.4 and below — incompatible webhook response structure

### Verified Compatible
- Webhook path: `22ad9668-47fd-4d5c-9cf7-69d72aa838e1` — unchanged from v0.6
- Input fields: `baseSheetName`, `clientName`, `fileData` — unchanged
- Response structure: `success`, `sdr.evars`, `sdr.props`, `sdr.events` — unchanged

---

## [0.5.1] - 2026-01-29

### Fixed
- **Critical**: Fixed Docker Compose context path from `./excel-service` to `.` (Issue #1)
  - File: `docker-compose.yml` line 4
  - Impact: Docker build now works correctly

### Changed
- **Critical**: Updated default webhook URL to match n8n v0.6 actual endpoint (Issue #2)
  - File: `public/index.html` line 239
  - Old: `http://localhost:5678/webhook-test/brd-sdr-excel`
  - New: `http://localhost:5678/webhook/22ad9668-47fd-4d5c-9cf7-69d72aa838e1`
  - Impact: Default URL now works without manual editing

### Added
- Environment variable support with dotenv package (Issue #3)
  - File: `server.js` - Added `require('dotenv').config()`
  - File: `.env.example` - Configuration template
  - File: `.env` - Local configuration (gitignored)
  - Variables: PORT, NODE_ENV, N8N_WEBHOOK_URL, SHEET_NAME_*

- Configurable Excel sheet names (Issue #4)
  - File: `server.js` - Added SHEET_NAMES configuration object
  - Sheet names now read from environment variables
  - Defaults: 'eVars', 'props', 'custom events (metrics)'
  - Lines affected: 60, 80, 101

- Enhanced server startup logging
  - Displays configured sheet names on startup
  - Shows all endpoint URLs

### Documentation
- **Major update**: `README.md` - Comprehensive integration guide
  - Added n8n workflow integration section
  - Added data contract documentation
  - Added troubleshooting section
  - Added architecture explanation
  - Added configuration guide with environment variables
  - Added security considerations for production

- **Major update**: `/base-docs/PROJECT.md` - System architecture
  - Added two-system architecture explanation
  - Python LangGraph vs n8n+webhook-service comparison
  - System selection guide table
  - Data flow diagrams

- **Updated**: `.gitignore` - Added webhook-service entries
  - Added `webhook-service/output/`
  - Added `webhook-service/.env`
  - Added `node_modules/`
  - Added `package-lock.json`

### Dependencies
- Added: `dotenv` ^16.0.3

## [0.5.0] - 2026-01-19

### Initial Release
- Excel generation microservice using ExcelJS
- Solves n8n 2.0.3 ExcelJS compatibility issues
- RESTful API endpoints: `/generate-excel`, `/health`
- Web UI for manual testing
- Docker support with health checks
- Integration with n8n workflow for AI-powered SDR generation

### Features
- Preserves Excel template formatting
- Supports eVars, Props, Events mapping
- Base64 file handling for large uploads
- 50mb payload limit for Excel files
- Automatic output directory creation
- Timestamped output filenames

---

## Migration Notes

### From excel-service to webhook-service

The service was moved from `n8n-cloud/v0.5/excel-service/` to `webhook-service/` in the root directory.

**Reason**: Better separation of concerns - webhook-service is independent from n8n-cloud versioning.

**Breaking Changes**: None - API contract remains the same

**Action Required**:
1. Update any documentation referencing `excel-service` path
2. Update Docker scripts to use new path
3. Copy `.env.example` to `.env` and configure

### n8n Workflow Compatibility

This service is compatible with:
- ✅ n8n v0.6: BRD to SDR with TSD GoogleDrive - v0.6
- ✅ n8n v0.5: BRD to SDR - v0.5
- ❓ Older versions: May require webhook URL updates

### Excel Template Compatibility

Tested with Adobe Analytics SDR templates using sheet names:
- `eVars`
- `props`
- `custom events (metrics)`

For custom templates, configure sheet names in `.env` file.

---

## Upgrade Guide

### From 0.5.0 to 0.5.1

1. **Install new dependency**:
   ```bash
   npm install dotenv
   ```

2. **Create .env file**:
   ```bash
   cp .env.example .env
   ```

3. **Update webhook URL in .env**:
   - Get webhook ID from n8n workflow
   - Update N8N_WEBHOOK_URL value

4. **Update Docker Compose** (if using Docker):
   - Ensure `context: .` in docker-compose.yml
   - Rebuild image: `docker-compose build`

5. **Restart service**:
   ```bash
   npm start
   ```

6. **Verify configuration**:
   - Check console output for sheet names
   - Test health endpoint: `http://localhost:3000/health`

---

## Known Issues

### Open Issues

1. **No file cleanup mechanism** (Medium Priority)
   - Output folder accumulates files indefinitely
   - Workaround: Manual cleanup with `find ./output -type f -mtime +7 -delete`
   - Planned: Implement automatic cleanup in v0.6.0

2. **No authentication/authorization** (High Priority for Production)
   - Current: Development mode only
   - Workaround: Deploy behind firewall or VPN
   - Planned: Add API key authentication in v0.6.0

3. **No rate limiting** (Medium Priority)
   - Risk: DoS attacks
   - Workaround: Use reverse proxy with rate limiting
   - Planned: Add express-rate-limit in v0.6.0

### Resolved Issues

- ✅ Docker Compose path mismatch (v0.5.1)
- ✅ Hardcoded webhook URL (v0.5.1)
- ✅ No environment variable support (v0.5.1)
- ✅ Hardcoded sheet names (v0.5.1)

---

## Future Roadmap

### v0.6.0 (Planned)
- [ ] API key authentication
- [ ] Rate limiting
- [ ] CORS whitelist configuration
- [ ] Input validation (joi/zod)
- [ ] Automatic file cleanup (7-day retention)
- [ ] Winston/Pino logging
- [ ] Prometheus metrics endpoint

### v0.7.0 (Planned)
- [ ] Multiple template support
- [ ] Custom column mapping configuration
- [ ] Batch processing API
- [ ] S3/Cloud storage integration
- [ ] Webhook retry mechanism

### v1.0.0 (Planned)
- [ ] Production-ready security
- [ ] HTTPS/TLS support
- [ ] Load balancing support
- [ ] Monitoring dashboard
- [ ] Comprehensive test suite (Jest)
- [ ] CI/CD pipeline

---

For bug reports or feature requests, contact the project maintainer or create an issue in the project repository.
