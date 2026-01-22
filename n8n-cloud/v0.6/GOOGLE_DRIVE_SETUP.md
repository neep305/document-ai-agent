# Google Drive Upload Setup Guide

## Workflow: BRD to SDR with TSD GoogleDrive - v0.6

Google Drive에 TSD 파일(JavaScript, Markdown)을 자동 업로드하는 워크플로우입니다.

## 변경 사항

### 삭제된 노드:
- **Write Files** (fs 모듈 사용 불가)

### 추가된 노드:
1. **Split Files for Upload** - 파일을 2개 아이템으로 분리
2. **Upload to Google Drive** - Google Drive에 업로드
3. **Collect Upload Results** - 업로드 결과 수집 및 로그

## Workflow Structure

```
Parse TSD Output
    ↓
Split Files for Upload (2개 아이템으로 분리)
    ↓
Upload to Google Drive (각 파일 업로드)
    ↓
Collect Upload Results (결과 통합)
```

## Google Drive 설정

### 1. Google Cloud Console 설정

1. **프로젝트 생성**: https://console.cloud.google.com
2. **Google Drive API 활성화**:
   - APIs & Services → Library
   - "Google Drive API" 검색
   - Enable 클릭

3. **OAuth 2.0 클라이언트 ID 생성**:
   - APIs & Services → Credentials
   - Create Credentials → OAuth client ID
   - Application type: Web application
   - Authorized redirect URIs 추가:
     ```
     https://YOUR_N8N_DOMAIN/rest/oauth2-credential/callback
     ```
   - Client ID, Client Secret 복사

### 2. n8n Credential 생성

1. **n8n 접속** → Credentials 메뉴
2. **Add Credential** → "Google Drive OAuth2 API"
3. **정보 입력**:
   - **Client ID**: Google Cloud Console에서 복사
   - **Client Secret**: Google Cloud Console에서 복사
   - **Scope**: 자동 입력됨 (https://www.googleapis.com/auth/drive)
4. **Connect my account** 클릭
5. Google 계정 선택 및 권한 승인
6. Credential 저장

### 3. 워크플로우 설정

1. **Upload to Google Drive 노드** 선택
2. **Credential** 필드에서 생성한 credential 선택
3. **Drive ID**: "MyDrive" 선택 (기본값)
4. **Parent Folder**: 자동으로 `TSD/{clientName}` 폴더 생성

## 업로드 경로 구조

```
Google Drive (My Drive)
└── TSD/
    ├── eCommerce_Client_A/
    │   ├── eCommerce_Client_A_adobeDataLayer_2026-01-21T12-00-00.js
    │   └── eCommerce_Client_A_TSD_2026-01-21T12-00-00.md
    ├── RetailClient_B/
    │   ├── RetailClient_B_adobeDataLayer_2026-01-21T14-30-00.js
    │   └── RetailClient_B_TSD_2026-01-21T14-30-00.md
    └── ...
```

## 노드별 상세 설명

### Split Files for Upload

**기능**: Parse TSD Output의 단일 아이템을 2개 아이템으로 분리

**출력**:
```javascript
[
  // Item 1: JavaScript file
  {
    json: {
      clientName: "eCommerce_Client_A",
      filename: "eCommerce_Client_A_adobeDataLayer_2026-01-21.js",
      content: "window.adobeDataLayer = ...",
      mimeType: "application/javascript",
      fileType: "JavaScript",
      stats: { ... }
    }
  },
  // Item 2: Markdown file
  {
    json: {
      clientName: "eCommerce_Client_A",
      filename: "eCommerce_Client_A_TSD_2026-01-21.md",
      content: "# Technical Solution Design...",
      mimeType: "text/markdown",
      fileType: "Markdown",
      stats: { ... }
    }
  }
]
```

### Upload to Google Drive

**파라미터**:
- `operation`: "upload"
- `name`: `={{ $json.filename }}` (동적 파일명)
- `driveId`: "MyDrive"
- `parentFolder`: `={{ 'TSD/' + $json.clientName }}` (자동 폴더 생성)
- `binaryData`: false (텍스트 직접 전송)
- `fileContent`: `={{ $json.content }}`

**실행 횟수**: 2번 (각 아이템마다)

**출력** (각 파일당):
```json
{
  "id": "1a2b3c4d5e6f7g8h9i0j",
  "name": "eCommerce_Client_A_adobeDataLayer_2026-01-21.js",
  "mimeType": "application/javascript",
  "webViewLink": "https://drive.google.com/file/d/1a2b3c4d5e6f7g8h9i0j/view",
  "webContentLink": "https://drive.google.com/uc?id=1a2b3c4d5e6f7g8h9i0j&export=download",
  "createdTime": "2026-01-21T12:00:00.000Z"
}
```

### Collect Upload Results

**기능**: 2개 업로드 결과를 통합하여 최종 응답 생성

**출력**:
```json
{
  "success": true,
  "clientName": "eCommerce_Client_A",
  "googleDrive": {
    "folder": "TSD/eCommerce_Client_A",
    "files": [
      {
        "fileId": "1a2b3c4d5e6f7g8h9i0j",
        "fileName": "eCommerce_Client_A_adobeDataLayer_2026-01-21.js",
        "mimeType": "application/javascript",
        "webViewLink": "https://drive.google.com/file/d/...",
        "webContentLink": "https://drive.google.com/uc?id=...",
        "createdTime": "2026-01-21T12:00:00.000Z"
      },
      {
        "fileId": "2b3c4d5e6f7g8h9i0j1k",
        "fileName": "eCommerce_Client_A_TSD_2026-01-21.md",
        "mimeType": "text/markdown",
        "webViewLink": "https://drive.google.com/file/d/...",
        "webContentLink": "https://drive.google.com/uc?id=...",
        "createdTime": "2026-01-21T12:00:00.000Z"
      }
    ]
  },
  "totalFiles": 2
}
```

## 테스트

### 1. 워크플로우 임포트
```bash
# n8n UI에서
1. Workflows → Import from File
2. "BRD to SDR with TSD GoogleDrive - v0.6.json" 선택
3. Import 완료
```

### 2. Credential 설정
- "Upload to Google Drive" 노드 클릭
- Credential 필드에서 Google Drive OAuth2 API 선택
- 아직 없다면 위의 "Google Drive 설정" 참조하여 생성

### 3. 실행 테스트
```bash
# Webhook 테스트
curl -X POST http://localhost:5678/webhook/22ad9668-47fd-4d5c-9cf7-69d72aa838e1 \
  -H "Content-Type: application/json" \
  -d '{
    "clientName": "TestClient",
    "fileData": "<base64 encoded BRD excel>",
    "baseSheetName": "Requirements"
  }'
```

### 4. 결과 확인
1. **SDR 응답**: 즉시 반환 (eVars, props, events)
2. **Google Drive**: 10-30초 후 파일 업로드 완료
   - Google Drive → TSD/TestClient/ 폴더 확인
   - .js, .md 파일 2개 생성 확인

## 콘솔 로그

워크플로우 실행 시 다음 로그가 출력됩니다:

```
=== TSD Files Uploaded to Google Drive ===
Client: eCommerce_Client_A
Total files uploaded: 2
- eCommerce_Client_A_adobeDataLayer_2026-01-21T12-00-00.js
  ID: 1a2b3c4d5e6f7g8h9i0j
  Link: https://drive.google.com/file/d/1a2b3c4d5e6f7g8h9i0j/view
- eCommerce_Client_A_TSD_2026-01-21T12-00-00.md
  ID: 2b3c4d5e6f7g8h9i0j1k
  Link: https://drive.google.com/file/d/2b3c4d5e6f7g8h9i0j1k/view
```

## 파일 접근 방법

### 브라우저에서 보기:
```
webViewLink 사용
https://drive.google.com/file/d/{fileId}/view
```

### 직접 다운로드:
```
webContentLink 사용
https://drive.google.com/uc?id={fileId}&export=download
```

### Google Drive API로 접근:
```javascript
// File ID로 파일 가져오기
GET https://www.googleapis.com/drive/v3/files/{fileId}?alt=media
```

## Troubleshooting

### 1. "Insufficient Permission" 에러
```
Error: Insufficient Permission
```
**해결**: OAuth 권한 재승인
- n8n Credentials → Google Drive credential 재연결
- "Connect my account" 다시 클릭

### 2. "Parent folder not found" 에러
```
Error: Parent folder not found
```
**해결**: parentFolder 설정 확인
- 현재 설정: `={{ 'TSD/' + $json.clientName }}`
- n8n이 자동으로 폴더 생성하도록 설정됨
- Google Drive API v3에서는 자동 생성 지원

### 3. "File already exists" 에러
- 타임스탬프가 포함되어 있어 충돌 없음
- 만약 발생 시: 파일명에 밀리초 추가 고려

### 4. 업로드 느림
- 파일 크기가 큰 경우 시간 소요
- JavaScript/Markdown 파일은 보통 수 KB ~ 수십 KB
- 예상 업로드 시간: 2-5초/파일

## 권한 관리

### 업로드된 파일 공유:
1. **Google Drive 웹에서 수동 공유**
2. **n8n에서 자동 공유** (추가 노드 필요):
```json
{
  "parameters": {
    "operation": "share",
    "fileId": "={{ $json.fileId }}",
    "permissions": {
      "role": "reader",
      "type": "anyone"
    }
  },
  "name": "Share File",
  "type": "n8n-nodes-base.googleDrive"
}
```

## 비용

- **Google Drive API**: 무료 (일일 한도: 1억 쿼리)
- **n8n**: 실행 수에 따라 과금 (클라우드 버전)
- **OpenAI API**: TSD Agent 실행 시 비용 발생

## 다음 단계

1. **Slack 알림 추가**: 업로드 완료 시 Slack 메시지 전송
2. **이메일 전송**: 파일 링크를 이메일로 전송
3. **버전 관리**: 동일 클라이언트의 이전 버전 백업
4. **Multi-platform TSD**: Mobile, Flutter SDK 추가

## 참고 자료

- [Google Drive API Documentation](https://developers.google.com/drive/api/v3/about-sdk)
- [n8n Google Drive Node](https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.googledrive/)
- [TSD_WORKFLOW_GUIDE.md](TSD_WORKFLOW_GUIDE.md)
