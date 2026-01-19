# 간단한 테스트 워크플로우 가이드

## 목적

복잡한 AI Agent와 ExcelJS를 제거하고 **기본 기능만 테스트**하는 워크플로우입니다.

이것으로 어디서 에러가 발생하는지 정확히 파악할 수 있습니다.

---

## 워크플로우 구조

### BRD_to_SDR_Workflow_Simple.json

**노드 (총 7개)**:
1. Webhook Trigger (responseMode: lastNode)
2. Extract and Validate (데이터 추출)
3. Create Binary (Base64 → Binary 변환)
4. Read Requirements Sheet (Excel 읽기)
5. Parse Requirements (요구사항 파싱)
6. Generate Mock SDR (Mock 데이터 생성 - AI 없음)
7. Final Response (JSON 응답)

**제거된 것**:
- ❌ AI Agent (에러 가능성 제거)
- ❌ OpenAI GPT-4o (Credential 문제 제거)
- ❌ LangChain Tools (설정 문제 제거)
- ❌ ExcelJS (모듈 의존성 제거)
- ❌ Excel 파일 쓰기 (복잡도 제거)

**남은 것**:
- ✅ Webhook 수신
- ✅ Base64 → Binary 변환
- ✅ Excel 파일 읽기
- ✅ 데이터 파싱
- ✅ Mock SDR 생성
- ✅ JSON 응답

---

## 사용 방법

### Step 1: 워크플로우 임포트

1. **n8n 대시보드**
   ```
   http://54.116.8.155:5678
   ```

2. **Import from File**
   - `BRD_to_SDR_Workflow_Simple.json` 선택

3. **확인**
   - 노드 7개 표시
   - 빨간 경고 없음 (Credential 필요 없음!)

### Step 2: 활성화

1. **Active 토글 ON**

2. **Webhook URL 확인**
   ```
   http://54.116.8.155:5678/webhook/brd-sdr-test
   ```

### Step 3: 테스트

```bash
# 실제 Excel 파일로 테스트
FILE_BASE64=$(base64 -i /Users/jason/dev/ai/document-ai-agent/n8n-cloud/v0.3/AA_BRD_SDR_Test_01122026.xlsx)

curl -X POST \
  http://54.116.8.155:5678/webhook/brd-sdr-test \
  -H 'Content-Type: application/json' \
  -d "{
    \"clientName\": \"Test Client\",
    \"fileData\": \"$FILE_BASE64\"
  }"
```

### 예상 응답 (성공 시)

```json
{
  "success": true,
  "message": "BRD processing complete (test mode - no Excel generation)",
  "clientName": "Test Client",
  "stats": {
    "evars": 2,
    "props": 1,
    "events": 1
  },
  "totalRequirements": 4
}
```

---

## 단계별 에러 진단

각 노드는 `console.log`로 상세한 로그를 출력합니다.

### Node 1: Webhook Trigger
- **성공**: POST 요청 수신
- **실패**: 404 에러 → 워크플로우 비활성화 상태

### Node 2: Extract and Validate
- **성공**: `{ clientName, fileData, step: 'extracted' }`
- **실패**: `Missing data` 에러
  - → JSON body 구조 문제
  - → `clientName` 또는 `fileData` 누락

### Node 3: Create Binary
- **성공**: Binary 객체 생성
- **실패**: `Invalid base64 data`
  - → Base64 인코딩 문제
  - → 파일 데이터 손상

### Node 4: Read Requirements Sheet
- **성공**: Excel 행 읽기
- **실패**:
  - `Sheet 'Requirements' not found` → 시트명 불일치
  - `Failed to read file` → Binary 데이터 문제
  - `Invalid file format` → Excel 파일 손상

### Node 5: Parse Requirements
- **성공**: Requirements 파싱
- **실패**: `No requirements found`
  - → 데이터 형식 문제
  - → 컬럼명 불일치

### Node 6: Generate Mock SDR
- **성공**: Mock 데이터 생성
- **실패**: (이 노드는 거의 실패하지 않음)

### Node 7: Final Response
- **성공**: JSON 응답 반환
- **실패**: (이 노드는 거의 실패하지 않음)

---

## 에러 발생 시 확인 방법

### 1. n8n Executions
```
http://54.116.8.155:5678/executions
```

- 빨간 X 실행 클릭
- 빨간색 노드 확인
- 에러 메시지 확인

### 2. 콘솔 로그 확인

n8n은 `console.log` 출력을 보여줍니다:
- 각 노드 클릭
- "Output" 탭 확인
- 로그 메시지 읽기

### 3. 단계별 테스트

각 노드를 개별적으로 테스트:
1. "Execute Node" 클릭
2. 출력 확인
3. 다음 노드로 진행

---

## 디버깅 시나리오

### 시나리오 1: Node 2에서 실패

```
Error: Missing data: clientName=true, fileData=false
```

**원인**: `fileData`가 전달되지 않음

**해결**:
- curl 명령어에서 `fileData` 확인
- Base64 인코딩 재확인
- JSON 구조 확인

---

### 시나리오 2: Node 3에서 실패

```
Error: Invalid base64 data
```

**원인**: Base64 문자열에 잘못된 문자

**해결**:
```bash
# Base64 유효성 확인
echo "$FILE_BASE64" | base64 -d > /tmp/test.xlsx
file /tmp/test.xlsx  # 파일 타입 확인
```

---

### 시나리오 3: Node 4에서 실패

```
Error: Sheet 'Requirements' not found
```

**원인**: Excel 파일에 "Requirements" 시트 없음

**해결**:
1. Excel 파일 열기
2. 시트명 확인
3. "Read Requirements Sheet" 노드에서 `sheetName` 수정

---

### 시나리오 4: 모든 노드 성공!

```json
{
  "success": true,
  "stats": { ... }
}
```

**의미**: 기본 기능은 정상 작동

**다음 단계**:
- AI Agent 추가
- ExcelJS로 파일 생성 추가

---

## HTML 테스트 페이지로 테스트

### upload_test.html 수정

```html
<!-- Webhook URL 변경 -->
<input
    type="text"
    id="webhookUrl"
    value="http://54.116.8.155:5678/webhook/brd-sdr-test"
>
```

### 테스트

1. HTML 파일 열기
2. Webhook URL: `http://54.116.8.155:5678/webhook/brd-sdr-test`
3. Client Name: `Test Client`
4. Excel 파일 선택
5. Upload

**예상 결과**:
```
✅ Success!

{
  "success": true,
  "message": "BRD processing complete (test mode - no Excel generation)",
  ...
}
```

---

## 성공 후 다음 단계

이 Simple 버전이 성공하면:

### Step 1: ExcelJS 추가

"Generate Mock SDR" 노드를 "Write SDR to Excel"로 교체

### Step 2: AI Agent 추가

"Generate Mock SDR" 대신 실제 AI Agent 사용

### Step 3: 통합

모든 기능을 하나의 워크플로우로 통합

---

## 로그 메시지 예시

### 성공 시 콘솔 출력

```
=== Webhook Input ===
Keys: ['body', 'headers', 'params', 'query']
Body keys: ['clientName', 'fileData']

Client Name: Test Client
File Data length: 245832

=== Converting to Binary ===
Base64 length: 245832
Binary created successfully

=== Processing Requirements ===
Client: Test Client
Rows received: 69
Requirements parsed: 69

=== Generating Mock SDR ===
Client: Test Client
Total Requirements: 69
Mock SDR generated

=== Workflow Complete ===
Client: Test Client
Stats: { evars: 2, props: 1, events: 1 }
```

---

## 트러블슈팅 체크리스트

### 기본 확인
- [ ] 워크플로우 활성화됨 (Active ON)
- [ ] Webhook URL 정확함
- [ ] Excel 파일 존재함
- [ ] Base64 인코딩 정상

### 에러 발생 시
- [ ] n8n Executions 확인
- [ ] 빨간색 노드 찾기
- [ ] 에러 메시지 읽기
- [ ] 콘솔 로그 확인

### 각 노드 확인
- [ ] Node 2: clientName, fileData 추출됨
- [ ] Node 3: Binary 생성됨
- [ ] Node 4: Excel 읽기 성공
- [ ] Node 5: Requirements 파싱됨
- [ ] Node 6: Mock SDR 생성됨
- [ ] Node 7: 응답 반환됨

---

## 요약

**목적**: 복잡한 부분을 제거하고 기본 기능만 테스트

**장점**:
- ✅ Credential 불필요
- ✅ ExcelJS 불필요
- ✅ AI/OpenAI 불필요
- ✅ 빠른 디버깅

**다음 단계**:
1. 이 Simple 버전 테스트
2. 어느 노드에서 에러 발생하는지 확인
3. 해당 노드만 수정
4. 단계적으로 기능 추가

**테스트 URL**:
```
http://54.116.8.155:5678/webhook/brd-sdr-test
```

이제 이 워크플로우로 테스트해보세요!
