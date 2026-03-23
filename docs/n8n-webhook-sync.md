# n8n ↔ webhook-service 동기화 개발 가이드

> **대상**: webhook-service(`server.js`) 및 n8n 워크플로우 JSON을 함께 개발·유지보수하는 개발자  
> **최종 업데이트**: 2026-03-21  
> **검증 환경**: n8n v1.x (로컬), webhook-service Node.js (포트 3000)

---

## 목차

1. [시스템 구조 개요](#1-시스템-구조-개요)
2. [환경 변수 설정](#2-환경-변수-설정)
3. [API 인증 체계](#3-api-인증-체계)
4. [Job 생명주기 & 상태 동기화](#4-job-생명주기--상태-동기화)
5. [Callback 프로토콜](#5-callback-프로토콜)
6. [n8n Execution Stop 흐름](#6-n8n-execution-stop-흐름)
7. [실시간 상태 전달 (SSE)](#7-실시간-상태-전달-sse)
8. [n8n 워크플로우 JSON 규칙](#8-n8n-워크플로우-json-규칙)
9. [Docker 네트워크 주의사항](#9-docker-네트워크-주의사항)
10. [테스트 커버리지](#10-테스트-커버리지)
11. [트러블슈팅](#11-트러블슈팅)
12. [새 워크플로우 추가 체크리스트](#12-새-워크플로우-추가-체크리스트)

---

## 1. 시스템 구조 개요

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (UI)                             │
│  triggerStage() ──POST /trigger/{stage}──► server.js            │
│  EventSource  ◄──SSE /events/{jobId}───── server.js            │
│  pollStatus() ──GET /status/{jobId}────►  server.js            │
│  cancelJob()  ──POST /jobs/{jobId}/cancel► server.js           │
└─────────────────────────────────────────────────────────────────┘
                              │ HTTP POST
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   webhook-service (port 3000)                   │
│                                                                 │
│  jobs: Map<jobId, Job>          sseClients: Map<jobId, Set>     │
│  ┌─ callN8nAndRegisterJob() ─────────── POST → n8n webhook     │
│  ├─ stopN8nExecution()      ─────────── POST → n8n stop API    │
│  ├─ getN8nSessionCookie()   ─────────── POST /rest/login        │
│  └─ fetchLatestRunningExecutionId() ─── GET /api/v1/executions │
└──────────────────────────┬──────────────────────────────────────┘
                           │ POST callbackUrl
                           │ (단계 완료 / 최종 결과)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    n8n (port 5678)                              │
│                                                                 │
│  /webhook/sdr   → Document AI - SDR v2.0                       │
│  /webhook/tsd   → Document AI - TSD v2.0                       │
│  /webhook/tags  → Document AI - Tags v2.0                      │
│                                                                 │
│  각 워크플로우: Webhook Trigger → AI 처리 → HTTP Notify Callback │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 환경 변수 설정

### webhook-service/.env 필수 항목

| 변수명 | 예시 값 | 설명 |
|--------|---------|------|
| `PORT` | `3000` | webhook-service 포트 |
| `N8N_SDR_WEBHOOK_URL` | `http://localhost:5678/webhook/sdr` | SDR 워크플로우 트리거 URL |
| `N8N_TSD_WEBHOOK_URL` | `http://localhost:5678/webhook/tsd` | TSD 워크플로우 트리거 URL |
| `N8N_TAGS_WEBHOOK_URL` | `http://localhost:5678/webhook/tags` | Tags 워크플로우 트리거 URL |
| `N8N_API_KEY` | `eyJhbG...` | n8n Public API 인증 키 (만료일 관리 필수) |
| `N8N_API_BASE_URL` | `http://localhost:5678` | Stop API 전용 Base URL (**webhook URL과 분리**) |
| `N8N_EMAIL` | `user@example.com` | n8n 로그인 이메일 (session cookie 방식) |
| `N8N_PASSWORD` | `password` | n8n 로그인 비밀번호 (session cookie 방식) |
| `CALLBACK_HOST` | `host.docker.internal` | n8n → webhook-service 역방향 콜백 호스트 |

### 웹훅 URL 모드 전환 규칙

`server.js`의 `getN8nUrl(stage)` 함수가 런타임 모드에 따라 URL을 동적 생성：

```javascript
// .env의 URL에서 /webhook 또는 /webhook-test 제거 후 재조합
const modeSegment = n8nMode === 'test' ? '/webhook-test' : '/webhook';
return base + modeSegment + '/' + stage;
```

| `.env 설정 URL` | production 모드 | test 모드 |
|----------------|-----------------|-----------|
| `http://localhost:5678/webhook/sdr` | `/webhook/sdr` | `/webhook-test/sdr` |
| `http://localhost:5678/webhook-test/sdr` | `/webhook/sdr` | `/webhook-test/sdr` |

> **주의**: `.env`의 URL에 `/sdr`, `/tsd`, `/tags` suffix나 `/webhook`, `/webhook-test`가 있어도  
> 코드에서 자동으로 벗겨내고 `n8nMode`에 맞는 URL을 재조합함.

---

## 3. API 인증 체계

### n8n v1.x 인증 방식 실증 결과

| 엔드포인트 | X-N8N-API-KEY | Basic Auth | Session Cookie |
|-----------|:---:|:---:|:---:|
| `/api/v1/*` (Public API) | ✅ | ❌ | - |
| `/rest/*` (Internal API) | ❌ 401 | ❌ 401 (v1.x에서 제거) | ✅ |
| `/rest/login` | - | - | - (로그인 엔드포인트) |

> **핵심**: n8n v1.x에서 `/rest/` 엔드포인트는 `X-N8N-API-KEY`를 **거부**한다.  
> test mode execution stop 등 internal API 사용 시 session cookie가 필수.

### Session Cookie 획득 방법

```javascript
// POST /rest/login
{
  "emailOrLdapLoginId": "user@example.com",  // ← 반드시 이 필드명 사용 ("email" 아님)
  "password": "password"
}
// 응답 헤더 Set-Cookie에서 n8n-auth 쿠키 추출
```

`server.js`의 `getN8nSessionCookie()` 함수가 8시간 캐시로 관리함.

### API Key 만료 관리

```
N8N_API_KEY = eyJhbGciOiJIUzI1NiIs... (만료: 2026-04-18)
```

만료 전 갱신 절차: **n8n UI → Settings → API → Create new API key → `.env` 업데이트**

---

## 4. Job 생명주기 & 상태 동기화

### Job 상태 흐름

```
                    [UI] triggerStage()
                          │
                          ▼
                    POST /trigger/{stage}
                          │
                          ▼
              callN8nAndRegisterJob()
              ┌─────────────────┐
              │  status: 'processing'  │
              │  n8nExecutionId: null  │ ← 초기 (pending)
              └─────────────────┘
                    │         │
              (executionId    (executionId
               즉시 응답)      없음 → fallback poller 2s 후 조회)
                    │         │
                    └────┬────┘
                         ▼
              ┌─────────────────────────────┐
              │ status: 'processing'         │
              │ n8nExecutionId: "173"        │ ← 확보
              │ steps: [active, pending...]  │
              └─────────────────────────────┘
                         │
              ┌──────────┴──────────┐
              │  n8n 단계 완료 콜백  │
              │  POST /webhook/sdr-result │
              └──────────┬──────────┘
                         ▼
              ┌─────────────────────────────┐
              │ status: 'completed' / 'failed' / 'cancelled' │
              └─────────────────────────────┘
```

### Job 객체 스키마

```typescript
interface Job {
  jobId: string;           // "doc-ai-{timestamp}-{random}"
  status: 'processing' | 'completed' | 'failed' | 'cancelled';
  createdAt: string;       // ISO 8601
  updatedAt: string;       // ISO 8601
  clientName?: string;
  stage?: 'sdr' | 'tsd' | 'tags';
  n8nExecutionId?: string; // n8n execution ID (처음엔 null일 수 있음)
  steps?: Step[];
  result?: object;         // 완료 시 n8n 최종 콜백 body
  error?: string;          // 실패 시 에러 메시지
}

interface Step {
  step: number;
  name: string;            // 'trigger' | 'sdr' | 'excel' | 'tsd_ai' | 'tsd_docx' | 'tags_create'
  status: 'pending' | 'active' | 'completed' | 'failed' | 'cancelled';
  updatedAt: string | null;
}
```

### 단계별 Step 정의

**SDR 워크플로우**:
| step | name | 완료 조건 |
|------|------|-----------|
| 1 | trigger | trigger 직후 즉시 completed |
| 2 | sdr | n8n callback `step_sdr_done` 수신 |
| 3 | excel | n8n callback `step_excel_done` 수신 |

**TSD 워크플로우**:
| step | name | 완료 조건 |
|------|------|-----------|
| 1 | trigger | trigger 직후 즉시 completed |
| 2 | tsd_ai | n8n callback `step_tsd_done` 수신 |
| 3 | tsd_docx | n8n callback `completed` 수신 |

**Tags 워크플로우**:
| step | name | 완료 조건 |
|------|------|-----------|
| 1 | trigger | trigger 직후 즉시 completed |
| 2 | tags_create | n8n callback `completed` 수신 |

---

## 5. Callback 프로토콜

### callback URL 주입

webhook-service가 n8n 트리거 시 payload에 `callbackUrl`을 포함해 전달:

```javascript
// server.js의 /trigger/sdr
const callbackUrl = `http://${CALLBACK_HOST}:${PORT}/webhook/sdr-result`;
// payload에 포함
{ clientName, fileName, fileBase64, baseSheetName, callbackUrl }
```

n8n 워크플로우 내 httpRequest 노드는 이 `callbackUrl`로 역방향 알림:

```javascript
// n8n 워크플로우 내 "Notify Step SDR Done" 노드
url: ={{ $('Generate Job ID').first().json.callbackUrl
         || 'http://host.docker.internal:3000/webhook/sdr-result' }}
// ↑ fallback URL: Docker 환경에서 callbackUrl 없을 때 사용
```

### Callback Body 스키마

```typescript
interface CallbackBody {
  jobId: string;
  executionId: string;     // $execution.id (n8n 실행 ID)
  status: CallbackStatus;
  message?: string;
  error?: string;
  // status === 'completed' 시 추가 결과 필드
  clientName?: string;
  sdrJson?: object;
  googleDrive?: { files: DriveFile[] };
  completedAt?: string;
}

type CallbackStatus =
  | 'step_sdr_done'    // SDR AI 처리 완료
  | 'step_excel_start' // Excel 생성 시작
  | 'step_excel_done'  // Excel 완료
  | 'step_tsd_start'   // TSD 생성 시작
  | 'step_tsd_done'    // TSD 문서 완료
  | 'step_tags_start'  // Tags 생성 시작
  | 'completed'        // 전체 워크플로우 완료
  | 'failed';          // 실패
```

### STEP_TRANSITIONS 매핑 (server.js)

```javascript
const STEP_TRANSITIONS = {
  'step_sdr_done':    { complete: 'sdr' },
  'step_excel_start': { activate: 'excel' },
  'step_excel_done':  { complete: 'excel' },
  'step_tsd_start':   { activate: 'tsd_ai' },
  'step_tsd_done':    { complete: 'tsd_ai', activate: 'tsd_docx' },
  'step_tags_start':  { activate: 'tags_create' },
};
// 'completed': 모든 step completes, job.status = 'completed'
// 'failed':    job.status = 'failed', job.error 저장
```

### 취소된 Job 콜백 처리

```javascript
// 취소된 job으로 callback이 들어오면 무시 (n8n이 느리게 완료 응답을 보내는 경우 대비)
if (existingForCheck && existingForCheck.status === 'cancelled') {
    return res.json({ received: true, ignored: true });
}
```

---

## 6. n8n Execution Stop 흐름

### 3단계 Stop 전략 (server.js `stopN8nExecution()`)

```
cancel 요청 → stopN8nExecution(executionId) (비동기)

Stage 1: POST /api/v1/executions/{id}/stop + X-N8N-API-KEY
         ↓ 200 → 완료 ✅
         ↓ 404 → Stage 2로

Stage 2: 동일 요청 3회 재시도 (3초 간격, 총 최대 9초)
         이유: 트리거 직후 execution이 DB에 등록되는 타이밍 지연
         ↓ 200 → 완료 ✅
         ↓ 404 계속 → Stage 3으로

Stage 3: POST /rest/login → session cookie 획득
         POST /rest/executions/{id}/stop + Cookie 헤더
         이유: test mode(inactive workflow)는 Public API가 항상 404
         ↓ 200 → 완료 ✅
         ↓ 500 "Failed to find execution" → 이미 종료됨 (정상)
```

### 언제 어느 Stage가 동작하는가

| 상황 | 동작 Stage | 소요 시간 |
|------|-----------|----------|
| Production (active) 워크플로우, 정상 타이밍 | Stage 1 | ~0.5s |
| Production, 트리거 직후 즉시 cancel | Stage 2 (1~3번째 재시도) | 3~9s |
| Test mode (inactive 워크플로우) | Stage 3 | ~10s |

### executionId 확보 방법

n8n 워크플로우가 `$execution.id`를 초기 webhook 응답에 포함하지 않은 경우:

```javascript
// callN8nAndRegisterJob() 내부
if (!n8nExecutionId && N8N_API_KEY) {
    setTimeout(async () => {
        const id = await fetchLatestRunningExecutionId();
        // GET /api/v1/executions?status=running → 이름 필터
        // fallback: GET /api/v1/executions?limit=20 → running 필터
    }, 2000);
}
```

**즉시 응답 포함하려면** n8n 워크플로우 JSON의 `Respond with JSON` 노드에 `executionId: $execution.id` 추가 후 **n8n UI에서 재임포트** 필요.

---

## 7. 실시간 상태 전달 (SSE)

### SSE 구독 흐름

```
UI: EventSource('/events/{jobId}')
       │
       ▼
server.js: /events/:jobId
  - Content-Type: text/event-stream
  - 현재 job 상태 즉시 전송 (연결 직후)
  - 15초마다 ': heartbeat\n\n' (연결 유지)
  - callback 수신 시 sseClients.get(jobId).forEach(res => res.write(event))
  - cancel 시 write → end (연결 종료)
```

### SSE 이벤트 데이터 형식

```
data: {"jobId":"doc-ai-123","status":"processing","steps":[...]}\n\n
```

### UI의 SSE 수신 처리 (index.html)

```javascript
function handleJobUpdate(stage, job) {
  if (job.status === 'completed') finishStage(stage, 'done', job);
  else if (job.status === 'failed')    finishStage(stage, 'failed', job);
  else if (job.status === 'cancelled') finishStage(stage, 'cancelled', job);
  // steps 배열 처리
  job.steps?.forEach(s => {
    setStep(stage, s.name, s.status === 'completed' ? 'done'
                         : s.status === 'active'    ? 'active'
                         : s.status === 'failed'    ? 'error'
                         : s.status === 'cancelled' ? 'cancelled' : 'idle');
  });
}
```

### Polling fallback (5초 간격)

SSE 연결이 끊어지거나 이벤트 누락 시 `/status/{jobId}`로 보완:

```javascript
state[stage].poll = setInterval(() => pollStatus(stage, data.jobId), 5000);
// finishStage() 호출 시 clearInterval(state[stage].poll) 로 정리
```

---

## 8. n8n 워크플로우 JSON 규칙

### 필수 포함 노드 및 설정

모든 워크플로우는 아래 노드 패턴을 반드시 포함해야 한다:

#### 1) Generate Job ID (Code 노드)

```javascript
// callbackUrl, jobId를 payload에서 추출해 후속 노드에서 참조 가능하게 저장
return [{
  json: {
    jobId: $input.first().json.jobId || 'generated-id',
    callbackUrl: $input.first().json.callbackUrl,
    // ...기타 필드
  }
}];
```

#### 2) Respond with JSON (respondToWebhook 노드)

워크플로우 초기에 즉시 응답 (AI 처리 전에 실행):

```javascript
// 권장: executionId 포함
{
  "jobId": "={{ $('Generate Job ID').first().json.jobId }}",
  "executionId": "={{ $execution.id }}",
  "status": "processing"
}
```

> **중요**: `respondToWebhook`은 **webhook 트리거와 같은 실행 경로**에 있어야 함.  
> `executionId: $execution.id`를 포함해야 webhook-service가 executionId를 즉시 확보할 수 있음.

#### 3) Callback 노드 (httpRequest) 명명 규칙

```
Notify Step {단계} Done    → status: 'step_{단계}_done'
Notify Step {단계} Start   → status: 'step_{단계}_start'
Notify Callback            → status: 'completed' (최종)
Notify Error               → status: 'failed'
```

#### 4) Callback Body 필수 필드

```javascript
JSON.stringify({
  jobId: $('Generate Job ID').first().json.jobId,
  executionId: $execution.id,  // ← 반드시 포함 (executionId 추적용)
  status: 'step_sdr_done',
  message: '단계 설명'
})
```

#### 5) Callback URL fallback

```javascript
url: ={{ $('Generate Job ID').first().json.callbackUrl
     || 'http://host.docker.internal:3000/webhook/sdr-result' }}
```

### 워크플로우 JSON 업데이트 후 재임포트 절차

n8n 워크플로우 JSON 파일을 코드 에디터에서 수정한 경우 반드시 n8n UI에서 재임포트:

```
n8n UI → Workflows → (해당 워크플로우) → ⋯ (더보기) → Import from file
→ n8n-cloud/n8n-template/document_ai_{SDR|TSD|Tags}_v2.0.json 선택
→ Save → Active 토글 ON
```

> 재임포트하지 않으면 `$execution.id` 등 코드 변경사항이 반영되지 않음.

---

## 9. Docker 네트워크 주의사항

### 문제: webhook-service가 컨테이너 안에서 실행될 때

```
[컨테이너 내 webhook-service]
  → callbackUrl: http://localhost:3000/webhook/sdr-result  ← ❌ 자기 자신
  → N8N_API_BASE_URL: http://localhost:5678               ← ❌ 자기 자신

[올바른 설정]
  → CALLBACK_HOST=host.docker.internal
  → callbackUrl: http://host.docker.internal:3000/webhook/sdr-result  ✅
  → N8N_API_BASE_URL=http://host.docker.internal:5678                 ✅
```

### .env 환경별 설정 가이드

**호스트에서 직접 실행 (개발 환경)**:
```env
CALLBACK_HOST=localhost
N8N_API_BASE_URL=http://localhost:5678
```

**Docker 컨테이너 안에서 실행**:
```env
CALLBACK_HOST=host.docker.internal
N8N_API_BASE_URL=http://host.docker.internal:5678
```

**n8n도 Docker 컨테이너, webhook-service도 Docker 컨테이너 (같은 network)**:
```env
CALLBACK_HOST=webhook-service  # 컨테이너 이름
N8N_API_BASE_URL=http://n8n:5678  # n8n 컨테이너 이름
```

---

## 10. 테스트 커버리지

### 테스트 파일 목록

| 파일 | 목적 | 실행 명령 |
|------|------|----------|
| `test/test_n8n_api.js` | webhook-service 전체 API 통합 테스트 | `npm test` |
| `test/test_n8n_auth_and_execution.js` | n8n 인증 + execution 생명주기 E2E | `npm run test:integration` |
| `test/test_n8n_stop_api.js` | n8n Stop API 인증 방식 진단 | `npm run test:stop` |

### 테스트 시나리오 매핑

**test_n8n_api.js (27개 체크)**:
- GROUP 1: n8n 서버 연결성, API Key 인증
- GROUP 2: webhook-service 엔드포인트 (`/health`, `/files`, `/jobs`, `/status`)
- GROUP 3: n8n 웹훅 URL 도달 가능성 (SDR/TSD/Tags)
- GROUP 4: 모드 전환 (`/api/n8n-mode`), callback 수신
- GROUP 5: Stop/Cancel 플로우 (trigger → cancel → 409 재시도 → execution stop 확인)

**test_n8n_auth_and_execution.js (28개 체크)**:
- SCN-1: 서버 연결성
- SCN-2: API Key 인증 성공/실패
- SCN-3: Session Cookie 인증 (이메일/비밀번호 로그인)
- SCN-4: 워크플로우 목록 조회 (active 우선)
- SCN-5: 직접 webhook 트리거 → execution DB 생성 확인
- SCN-6: webhook-service → `/trigger/sdr` → jobId → cancel → n8n stop 확인 (최대 20초 폴링)

### Stop 확인 폴링 패턴

stop은 비동기로 최대 9초 소요되므로, 테스트는 20초 폴링으로 확인:

```javascript
const deadline = Date.now() + 20000;
while (Date.now() < deadline) {
  await new Promise(r => setTimeout(r, 2000));
  const exec = await fetchExecutionStatus(n8nExecId);
  if (exec.status !== 'running') break;
}
```

---

## 11. 트러블슈팅

### 문제 1: `/rest/` 엔드포인트 401 에러

```
HTTP 401: {"status":"error","message":"Unauthorized"}
```

**원인**: n8n v1.x에서 `/rest/` 엔드포인트는 `X-N8N-API-KEY` 헤더를 거부함.  
**해결**: `getN8nSessionCookie()`로 session cookie 획득 후 `Cookie` 헤더 사용.

---

### 문제 2: Stop API HTTP 404 반환

```
POST /api/v1/executions/{id}/stop → 404 not found
```

**원인 A**: test mode(inactive workflow) — Public API가 비활성 워크플로우 execution을 반환하지 않음.  
**해결**: Stage 3 session cookie fallback이 처리함 (`/rest/executions/{id}/stop`).

**원인 B**: 트리거 직후 즉시 stop — execution이 DB에 아직 등록 안 됨.  
**해결**: Stage 2 재시도(3회 × 3초)가 처리함.

---

### 문제 3: executionId `null` — n8n execution을 찾을 수 없음

```
⚠️  stopN8nExecution: executionId가 null
```

**원인**: n8n 워크플로우의 `Respond with JSON` 노드에 `executionId: $execution.id`가 없음.  
**해결**: 워크플로우 JSON에 추가 후 n8n UI에서 재임포트. 그 전까지는 fallback poller(2s)가 대신 조회.

---

### 문제 4: callback이 오지 않음 (n8n → webhook-service 역방향)

**체크리스트**:
1. `CALLBACK_HOST` 설정 확인 (Docker면 `host.docker.internal`)
2. n8n 워크플로우가 `callbackUrl`을 payload에서 올바르게 읽는지 확인
3. webhook-service 포트(3000)가 방화벽/Docker에서 접근 가능한지 확인
4. n8n 워크플로우 내 httpRequest 노드의 fallback URL 확인:
   `http://host.docker.internal:3000/webhook/sdr-result`

---

### 문제 5: n8n 세션 쿠키 401 — 세션 만료

```
⚠️  stopN8nExecution: internal API HTTP 401
→ 세션 만료. 캐시 초기화 — 다음 stop 시도 시 재로그인합니다.
```

**해결**: 자동으로 `_n8nSessionCache` 초기화됨. 다음 stop 시도에서 재로그인.  
**예방**: 8시간 캐시가 기본값. n8n 세션 TTL이 짧게 설정된 경우 캐시 TTL도 줄여야 함.

---

### 문제 6: SSE 연결이 끊어진 후 상태 업데이트 누락

**해결**: 5초 polling fallback이 보완함. `pollStatus(stage, jobId)` 확인.  
Job history → "Monitor" 버튼으로도 재연결 가능 (`resumeJob()`).

---

## 12. 새 워크플로우 추가 체크리스트

새로운 n8n 워크플로우(예: `validation`)를 추가할 때:

### server.js 수정

- [ ] `N8N_BASE_URLS`에 새 stage URL 추가
  ```javascript
  const N8N_BASE_URLS = {
    sdr: ..., tsd: ..., tags: ...,
    validation: process.env.N8N_VALIDATION_WEBHOOK_URL,  // 추가
  };
  ```
- [ ] `STEP_TRANSITIONS`에 callback status 매핑 추가
  ```javascript
  'step_validation_start': { activate: 'validation' },
  'step_validation_done':  { complete: 'validation' },
  ```
- [ ] `POST /trigger/validation` 엔드포인트 추가
- [ ] steps 배열 정의 (trigger + 단계들)

### .env 수정

- [ ] `N8N_VALIDATION_WEBHOOK_URL` 추가

### index.html 수정

- [ ] `state` 객체에 새 stage 추가
  ```javascript
  const state = { sdr: {...}, tsd: {...}, tags: {...}, validation: {...} };
  ```
- [ ] `endpoints` 객체에 추가
- [ ] 해당 탭 UI (progressCard, steps, stopBtn) 추가

### n8n 워크플로우 JSON

- [ ] Webhook Trigger 노드: path = `validation`
- [ ] Generate Job ID 노드: `callbackUrl`, `jobId` 추출
- [ ] Respond with JSON 노드: `executionId: $execution.id` 포함
- [ ] 각 단계 완료 시 Notify callback 노드 추가 (status: `step_validation_start`, `step_validation_done`)
- [ ] 최종 완료: status `completed`, 실패: status `failed`
- [ ] Fallback callbackUrl: `http://host.docker.internal:3000/webhook/sdr-result`
- [ ] n8n UI에 재임포트 + Active 토글 ON

### 테스트

- [ ] `test_n8n_api.js`의 GROUP 3, 5에 새 stage 케이스 추가
- [ ] `test_n8n_auth_and_execution.js` SCN-4, 5에 새 워크플로우 확인 추가
