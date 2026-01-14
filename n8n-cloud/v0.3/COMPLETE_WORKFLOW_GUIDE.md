# BRD to SDR - 완전한 워크플로우 가이드

## 개요

Simple 버전이 작동하는 것을 확인했으므로, 이제 **실제 AI와 Excel 생성 기능**을 추가한 완전한 버전입니다.

**파일명**: BRD_to_SDR_Workflow_Complete.json

---

## 추가된 기능

### Simple 버전 대비

| 기능 | Simple | Complete |
|------|--------|----------|
| Webhook 수신 | ✅ | ✅ |
| Excel 읽기 | ✅ | ✅ |
| Requirements 파싱 | ✅ | ✅ |
| **AI Agent (GPT-4o)** | ❌ Mock | ✅ **실제 AI** |
| **SDR 생성** | ❌ Mock 데이터 | ✅ **AI 생성** |
| **Excel 쓰기** | ❌ 없음 | ✅ **ExcelJS** |
| **파일 다운로드** | ❌ | ✅ **JSON 응답** |

---

## 노드 구성 (총 11개)

```
1. Webhook Trigger (responseMode: lastNode)
   ↓
2. Extract and Validate (데이터 추출)
   ↓
3. Create Binary (Base64 → Binary 변환)
   ↓
4. Read Requirements Sheet (Excel 읽기)
   ↓
5. Parse Requirements (요구사항 파싱)
   ↓
6. SDR Agent (AI 분석) ← OpenAI GPT-4o 사용
   ├─ Tool: Get Requirements
   └─ Tool: Get SDR Guide
   ↓
7. Parse SDR Output (AI 출력 파싱)
   ↓
8. Write SDR to Excel (ExcelJS로 파일 생성)
   ↓
9. Final Response (JSON 응답)
```

---

## 사전 준비

### 1. ExcelJS 설치 필요

**Docker n8n:**
```bash
docker exec -it n8n npm install -g exceljs
docker restart n8n
```

**일반 설치:**
```bash
npm install -g exceljs
systemctl restart n8n
```

### 2. OpenAI API Key 준비

- https://platform.openai.com/api-keys
- API Key 생성 또는 확인

---

## 설치 및 설정

### Step 1: ExcelJS 확인

```bash
# Docker
docker exec -it n8n npm list -g exceljs

# 설치 안 되어 있으면
docker exec -it n8n npm install -g exceljs
docker restart n8n
```

### Step 2: 워크플로우 임포트

1. **n8n 대시보드**
   ```
   http://54.116.8.155:5678
   ```

2. **Import from File**
   - `BRD_to_SDR_Workflow_Complete.json` 선택

3. **확인**
   - 노드 11개 표시
   - 빨간 경고 확인 (OpenAI Credential 필요)

### Step 3: OpenAI Credential 설정

1. **"OpenAI GPT-4o" 노드 클릭**

2. **Credential 생성**
   - Credentials → Create New
   - Name: `OpenAI API`
   - API Key: (여기에 입력)
   - Save

3. **워크플로우로 돌아가기**
   - "OpenAI GPT-4o" 노드에서 credential 선택
   - 빨간 경고 사라짐 확인

### Step 4: 워크플로우 활성화

1. **기존 워크플로우 비활성화**
   - "BRD to SDR - Simple Test" → Active OFF

2. **새 워크플로우 활성화**
   - "BRD to SDR - Complete" → Active ON

3. **경고 확인**
   - 경고 없으면 성공!

### Step 5: Webhook URL 확인

```
Production URL:
http://54.116.8.155:5678/webhook/brd-sdr-complete
```

---

## 테스트

### 방법 1: curl 명령어

```bash
# Excel 파일을 Base64로 변환
FILE_BASE64=$(base64 -i /Users/jason/dev/ai/document-ai-agent/n8n-cloud/v0.3/AA_BRD_SDR_Test_01122026.xlsx)

# Webhook 호출
curl -X POST \
  http://54.116.8.155:5678/webhook/brd-sdr-complete \
  -H 'Content-Type: application/json' \
  -d "{
    \"clientName\": \"eCommerce_Client_A\",
    \"fileData\": \"$FILE_BASE64\"
  }" | jq '.'
```

**예상 시간**: 30-60초 (AI 처리 시간)

### 방법 2: HTML 테스트 페이지

```html
<!-- upload_test.html 수정 -->
<input
    type="text"
    id="webhookUrl"
    value="http://54.116.8.155:5678/webhook/brd-sdr-complete"
>
```

1. HTML 파일 열기
2. Webhook URL 입력
3. Client Name 입력
4. Excel 파일 선택
5. Upload and Process 클릭
6. **30-60초 대기** (AI 처리)

---

## 예상 응답

### 성공 시

```json
{
  "success": true,
  "message": "SDR generation complete",
  "clientName": "eCommerce_Client_A",
  "fileName": "SDR_eCommerce_Client_A_2026-01-14.xlsx",
  "stats": {
    "evars": 42,
    "props": 28,
    "events": 19
  }
}
```

### 실패 시

```json
{
  "message": "Error in workflow",
  "node": "Node Name",
  "details": "Error details here"
}
```

---

## 생성된 파일 확인

### n8n Executions에서 다운로드

1. **Executions 메뉴**
   ```
   http://54.116.8.155:5678/executions
   ```

2. **최근 성공 실행 클릭**

3. **"Write SDR to Excel" 노드 클릭**

4. **Binary 탭**
   - "data" 항목 확인
   - Download 버튼 클릭

5. **다운로드된 파일 열기**
   - Requirements 시트: 원본 유지
   - eVars 시트: 30-50개 변수 ✅
   - Props 시트: 20-30개 변수 ✅
   - Events 시트: 15-25개 이벤트 ✅

---

## 트러블슈팅

### 문제 1: ExcelJS 모듈 없음

**에러**:
```
Error: Cannot find module 'exceljs'
Node: Write SDR to Excel
```

**해결**:
```bash
docker exec -it n8n npm install -g exceljs
docker restart n8n
```

### 문제 2: OpenAI API 에러

**에러**:
```
Error: Incorrect API key provided
Node: OpenAI GPT-4o
```

**해결**:
1. OpenAI 대시보드에서 API Key 확인
2. n8n Credentials 재설정
3. 사용량 한도 확인

### 문제 3: AI 출력 파싱 실패

**에러**:
```
Failed to parse SDR output
Node: Parse SDR Output
```

**원인**: AI가 JSON 형식을 정확히 출력하지 않음

**해결**:
1. Temperature 낮추기 (0.2 → 0.1)
2. 워크플로우 재실행
3. AI 프롬프트 확인

### 문제 4: 처리 시간 초과

**증상**: 60초 이상 응답 없음

**원인**:
- OpenAI API 응답 지연
- 네트워크 문제

**해결**:
1. 잠시 대기 (최대 2분)
2. Executions에서 진행 상황 확인
3. 재시도

---

## 성능 및 비용

### 예상 실행 시간

| 단계 | 시간 |
|------|------|
| Webhook → Binary 변환 | ~2초 |
| Excel 읽기 | ~1초 |
| Requirements 파싱 | ~1초 |
| **AI 분석 (GPT-4o)** | **30-60초** |
| SDR 파싱 | ~1초 |
| Excel 쓰기 | ~2초 |
| **총** | **35-70초** |

### OpenAI 비용

**GPT-4o 사용**:
- Input: ~4,000-6,000 tokens
- Output: ~4,000-6,000 tokens
- **비용**: ~$0.30-0.50 per execution

**비용 절감 팁**:
- gpt-4o-mini 사용: ~$0.05-0.10
- Temperature 낮추기
- 캐싱 활용

---

## 다음 단계

### 1. Binary 응답 설정 (선택사항)

Excel 파일을 JSON 응답 대신 직접 다운로드하려면:

**Webhook Trigger 노드 수정**:
```json
{
  "parameters": {
    "responseMode": "lastNode",
    "options": {
      "responseData": "firstEntryBinary"
    }
  }
}
```

그러면 브라우저에서 Excel 파일이 자동 다운로드됩니다!

### 2. 에러 처리 개선

- 재시도 로직 추가
- 타임아웃 처리
- 에러 알림 (Slack, Email)

### 3. 프로덕션 배포

- HTTPS 설정
- 인증 추가
- Rate limiting
- 로깅 강화

---

## 체크리스트

### 설치
- [ ] ExcelJS 설치됨
- [ ] n8n 재시작 완료
- [ ] OpenAI API Key 준비됨

### 설정
- [ ] 워크플로우 임포트 완료
- [ ] OpenAI Credential 설정 완료
- [ ] 모든 노드 빨간 경고 없음
- [ ] 워크플로우 활성화 (Active ON)

### 테스트
- [ ] curl 테스트 성공 (200 응답)
- [ ] 응답에 `success: true` 확인
- [ ] AI 처리 시간 30-60초 확인
- [ ] Executions에서 Excel 파일 다운로드 확인
- [ ] eVars/Props/Events 시트 데이터 확인

### 검증
- [ ] eVars: 30-50개
- [ ] Props: 20-30개
- [ ] Events: 15-25개
- [ ] 필수 변수 포함 (eVar1-3, prop1-3, event1)
- [ ] Requirement ID 매핑 정확

---

## 요약

**Simple 버전**: ✅ 작동 확인됨
**Complete 버전**:
- ✅ AI Agent 추가
- ✅ OpenAI GPT-4o 사용
- ✅ ExcelJS로 파일 생성
- ✅ 실제 SDR 생성

**다음 단계**:
1. ExcelJS 설치
2. OpenAI Credential 설정
3. Complete 워크플로우 임포트
4. 테스트 실행
5. Excel 파일 다운로드 확인

**Webhook URL**:
```
http://54.116.8.155:5678/webhook/brd-sdr-complete
```

**예상 시간**: 35-70초
**예상 비용**: $0.30-0.50 per execution

이제 실제로 AI가 BRD를 분석하고 SDR을 생성합니다! 🎉
