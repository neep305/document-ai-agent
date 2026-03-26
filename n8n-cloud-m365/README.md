# n8n-cloud-m365

Microsoft 365 업로드·후속 자동화용 **별도** n8n 스택입니다. [n8n-cloud](../n8n-cloud/)와 워크플로 JSON·데이터 디렉터리를 **섞지 않습니다**.

Google Drive 노드 대신 M365를 쓰는 방식(내장 노드 vs HTTP vs 공유 폴더)은 [docs/n8n-m365-vs-google-drive.md](../docs/n8n-m365-vs-google-drive.md)를 참고하세요.

## 포트

- 호스트 기본 **5680** → 컨테이너 **5678** (`N8N_PORT`로 변경 가능)
- 로컬에서 기존 n8n(`5678`)과 동시에 띄울 수 있습니다.

## 실행

```bash
cp .env.example .env
docker compose up --build
```

UI: `http://localhost:5680` (기본값 기준)

## 워크플로 템플릿

JSON은 [n8n-template](./n8n-template/)에 둡니다. 예시 워크플로 `m365_upload_via_webhook_service.example.json`을 가져와 API 키만 맞추면 중앙 Graph 업로드를 바로 시험할 수 있다. 문서 생성 파이프라인은 기존 인스턴스에서 두고, 마지막 단계만 **HTTP Request**로 [webhook-service-m365](../webhook-service-m365/)의 `POST /v1/upload`를 호출하는 식으로 연결할 수 있습니다.

Docker 네트워크에서 호스트의 업로드 서비스에 접근할 때는 `http://host.docker.internal:3001` (Windows/macOS Docker Desktop) 등 환경에 맞는 호스트명을 사용하세요.
