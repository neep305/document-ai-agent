# webhook-service-m365

[webhook-service](../webhook-service/)와 **동일한 소스 베이스**(Web UI, Excel/n8n 웹훅, Google Drive 탐색 등)를 복사해 두고, 여기에 **Microsoft Graph 업로드 API**를 추가한 변형입니다. 기본 HTTP 포트는 **3001**이라 로컬에서 원본(3000)과 동시에 띄우기 쉽습니다.

## 중복 유지보수

두 폴더는 의도적으로 **갈라질 수 있음**을 전제로 합니다. 공통 수정이 필요하면 양쪽을 맞추거나, 장기적으로는 공유 패키지로 추출하는 편이 좋습니다.

## M365 API

- `POST /v1/upload` — 헤더 `x-api-key: <M365_SERVICE_API_KEY>`, multipart `file` 또는 JSON `{ filename, contentBase64 }`. 선택 쿼리 `?folder=...`
- `GET /health` — 기존 Excel 서비스 필드 + `m365GraphConfigured`, `m365UploadPath`

자세한 환경 변수는 `.env.example`의 **Microsoft 365 / Graph** 절을 참고하세요.

## 로컬 실행

```bash
cp .env.example .env
npm install
npm start
```

- Web UI: `http://localhost:3001/`
- M365 업로드: `POST http://localhost:3001/v1/upload`

## Docker

```bash
cp .env.example .env
docker compose up --build
```

## 트러블슈팅 (n8n `503` / `M365_SERVICE_API_KEY is not configured`)

1. **서버 프로세스**에 `M365_SERVICE_API_KEY`가 비어 있으면 `POST /v1/upload`는 **503**을 돌려줍니다. `webhook-service-m365` 디렉터리에서 `.env`에 키를 넣고 **Node를 재시작**하세요 (`cp .env.example .env` 후 값 채우기).
2. n8n HTTP Request 노드의 헤더 **`x-api-key`** 값은 `.env`의 `M365_SERVICE_API_KEY`와 **동일**해야 합니다. 서버는 “키가 설정됐는지”와 “헤더가 일치하는지”를 따로 검사합니다.
3. 진단: 브라우저나 `curl`로 `GET http://localhost:3001/health` — `m365ApiKeyConfigured`, `m365GraphConfigured`, `m365UploadReady`가 `true`인지 확인합니다.
4. Docker Compose를 쓰는 경우 호스트 `.env`에 `M365_SERVICE_API_KEY`가 있어야 하며, 컨테이너를 다시 올립니다.

## 관련 문서

- [docs/n8n-m365-vs-google-drive.md](../docs/n8n-m365-vs-google-drive.md)
- [n8n-cloud-m365](../n8n-cloud-m365/)
