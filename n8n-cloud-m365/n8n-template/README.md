# n8n-template (M365)

이 디렉터리에 M365·SharePoint 업로드 후속 처리용 워크플로 `.json`을 보관합니다.

- 예시: [m365_upload_via_webhook_service.example.json](./m365_upload_via_webhook_service.example.json) — **이전 노드(또는 Webhook)의 `$json` payload**로 URL·헤더·본문을 채움. Manual 뒤의 Set 노드는 데모 값만 넣은 것이며, Webhook 등으로 같은 **필드 이름**을 넘기면 된다.

  | 필드 | 용도 |
  |------|------|
  | `uploadUrl` | 전체 업로드 URL (예: `http://host.docker.internal:3001/v1/upload`) |
  | `folder` | 쿼리 `?folder=` (SharePoint 하위 경로) |
  | `m365ApiKey` 또는 `apiKey` | 헤더 `x-api-key` |
  | `requesterId` | 선택, 헤더 `x-requester-id` |
  | `requestContext` | 선택, 헤더 `x-request-context` |
  | `contentType` | 선택, 기본 `application/json` |
  | `filename`, `contentBase64` | JSON 본문 필드 |
  | `bodyFolder` | 선택, 본문에 `folder` 포함 시 (쿼리와 별도) |
  | `timeoutMs` | 선택, HTTP 타임아웃(ms), 기본 120000 |

  서버 `.env`의 `M365_SERVICE_API_KEY`와 `m365ApiKey`를 맞추지 않으면 **401/503**이 날 수 있다.
- 기존 [n8n-cloud/n8n-template/](../../n8n-cloud/n8n-template/) 파일을 복사해 수정하지 말고, 필요 시 이쪽에 **새 파일**로 추가하세요.
- multipart `file` 업로드는 HTTP Request에서 Form-Data로 직접 구성할 수 있다(예시 워크플로는 JSON base64 경로).
