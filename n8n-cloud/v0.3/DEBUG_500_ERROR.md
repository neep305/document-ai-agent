# Webhook 500 Error 디버깅 가이드

## 현재 상황

```bash
curl -X POST http://54.116.8.155:5678/webhook/brd-sdr-upload
→ HTTP/1.1 500 Internal Server Error
→ {"message":"Error in workflow"}
```

**워크플로우는 실행되지만 처리 중 에러 발생**

---

## 에러 확인 방법

### 1. n8n Executions 확인 (가장 중요!)

**가장 확실한 방법**입니다.

1. **n8n 대시보드 접속**
   ```
   http://54.116.8.155:5678
   ```

2. **Executions 메뉴 클릭**
   - 좌측 사이드바에서 "Executions" 클릭

3. **최근 실행 확인**
   - 빨간색 X 표시가 있는 실행 찾기
   - 클릭해서 열기

4. **에러 노드 확인**
   - 빨간색으로 표시된 노드가 에러 발생 노드
   - 노드 클릭 → "Error" 탭 확인
   - 에러 메시지 전체 읽기

**이 정보가 있어야 정확한 해결책을 찾을 수 있습니다!**

---

## 주요 가능한 원인

### 원인 1: ExcelJS 모듈 없음

**증상**:
```
Error: Cannot find module 'exceljs'
Node: Write SDR to Excel
```

**확인**:
- n8n 서버 SSH 접속
- 또는 Executions에서 에러 메시지 확인

**해결**:

**Docker n8n:**
```bash
# 컨테이너 접속
docker exec -it n8n sh

# ExcelJS 설치
npm install -g exceljs

# 또는 로컬 설치
cd /root/.n8n
npm install exceljs

# n8n 재시작
exit
docker restart n8n
```

**일반 설치:**
```bash
# Global 설치
npm install -g exceljs

# 또는 n8n 디렉토리에 설치
cd ~/.n8n
npm install exceljs

# n8n 재시작
systemctl restart n8n
```

---

### 원인 2: OpenAI Credential 미설정

**증상**:
```
Error: No credentials found
Node: OpenAI GPT-4o
```

**해결**:

1. **n8n 대시보드 → Credentials**
2. **"Create New Credential"**
3. **"OpenAI API" 선택**
4. **설정**:
   - Name: `OpenAI API`
   - API Key: `sk-...` (OpenAI API Key)
5. **Save**
6. **워크플로우로 돌아가기**
7. **"OpenAI GPT-4o" 노드 클릭**
8. **Credential 연결**

---

### 원인 3: LangChain Tool 노드 문제

**증상**:
```
Error: workflowCode is not defined
Node: Tool: Get Requirements
```

**원인**: n8n 버전이 낮아서 `workflowCode` 파라미터를 지원하지 않음

**해결**: Tool 노드 파라미터 수정

기존:
```json
{
  "workflowCode": "..."
}
```

변경:
```json
{
  "jsCode": "..."
}
```

---

### 원인 4: Convert to Binary 노드 문제

**증상**:
```
Error: Cannot convert data to binary
Node: Convert to Binary
```

**원인**: Base64 데이터가 유효하지 않음

**해결**: 데이터 검증 추가

---

### 원인 5: Spreadsheet File 노드 문제

**증상**:
```
Error: Failed to read file
Node: Read Requirements Sheet
```

**원인**:
- Excel 파일 형식 문제
- Binary 데이터 전달 문제
- 시트 이름 불일치

**해결**:
1. Excel 파일이 유효한지 확인
2. Binary property name 확인
3. Sheet name 확인 ("Requirements")

---

## 디버깅용 워크플로우 생성

에러를 더 쉽게 찾기 위해 단순화된 테스트 워크플로우를 만들어보겠습니다.

### Test 1: Webhook → Response (기본 연결 테스트)

```json
{
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "test-simple",
        "responseMode": "lastNode"
      },
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook"
    },
    {
      "parameters": {
        "jsCode": "return [{ json: { message: 'Success!', input: $input.first().json } }];"
      },
      "name": "Test Code",
      "type": "n8n-nodes-base.code"
    }
  ]
}
```

**테스트**:
```bash
curl -X POST http://54.116.8.155:5678/webhook/test-simple \
  -H 'Content-Type: application/json' \
  -d '{"test": "data"}'
```

**예상**: 200 OK with `{"message": "Success!"}`

---

### Test 2: Base64 → Binary 변환 테스트

```json
{
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "test-binary",
        "responseMode": "lastNode"
      },
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook"
    },
    {
      "parameters": {
        "mode": "jsonToBinary",
        "sourceKey": "fileData",
        "options": {
          "fileName": "test.xlsx",
          "mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        }
      },
      "name": "Convert to Binary",
      "type": "n8n-nodes-base.convertToFile"
    },
    {
      "parameters": {
        "jsCode": "const binary = $input.first().binary; return [{ json: { success: true, hasBinary: !!binary } }];"
      },
      "name": "Check Binary",
      "type": "n8n-nodes-base.code"
    }
  ]
}
```

---

### Test 3: ExcelJS 모듈 테스트

```json
{
  "parameters": {
    "jsCode": "try { const ExcelJS = require('exceljs'); return [{ json: { exceljs: 'installed', version: ExcelJS.version || 'unknown' } }]; } catch (error) { return [{ json: { error: error.message } }]; }"
  },
  "name": "Test ExcelJS",
  "type": "n8n-nodes-base.code"
}
```

---

## 500 에러 해결 체크리스트

### 사전 준비
- [ ] n8n 대시보드 접속 가능
- [ ] OpenAI API Key 준비됨
- [ ] ExcelJS 설치 가능 (서버 접근 권한)

### 에러 확인
- [ ] n8n Executions에서 에러 노드 확인
- [ ] 에러 메시지 전체 복사
- [ ] 어떤 노드에서 실패했는지 파악

### ExcelJS 확인
- [ ] n8n 서버 접속
- [ ] `npm list -g exceljs` 실행
- [ ] 설치 안 되어 있으면 설치
- [ ] n8n 재시작

### Credentials 확인
- [ ] OpenAI Credential 생성됨
- [ ] API Key 유효함
- [ ] 워크플로우에서 Credential 연결됨

### 워크플로우 확인
- [ ] 모든 노드에 빨간 경고 없음
- [ ] Webhook Trigger 활성화됨
- [ ] 다른 워크플로우와 경로 충돌 없음

---

## 임시 해결책: Manual Trigger 사용

Webhook 디버깅이 어렵다면 먼저 **Manual Trigger 버전**으로 테스트:

1. **BRD_to_SDR_Workflow_Manual.json 임포트**
2. **파일 경로 설정**
   ```
   /Users/jason/dev/ai/document-ai-agent/n8n-cloud/v0.3/AA_BRD_SDR_Test_01122026.xlsx
   ```
3. **Execute Workflow 클릭**
4. **에러 확인**

이렇게 하면:
- Webhook 복잡도 제거
- Binary 변환 문제 제거
- 순수하게 처리 로직만 테스트

---

## 다음 단계

### 1. Executions 확인

**가장 먼저 해야 할 일**:
```
http://54.116.8.155:5678/executions
```

에러 메시지를 확인하고 알려주세요!

### 2. 에러 메시지 공유

다음 정보를 알려주시면 정확한 해결책을 드릴 수 있습니다:
- 어떤 노드에서 에러 발생?
- 에러 메시지는 무엇?
- 스택 트레이스가 있다면?

### 3. 서버 로그 확인 (선택사항)

```bash
# Docker
docker logs n8n --tail 100

# Systemd
journalctl -u n8n -n 100
```

---

## 자주 발생하는 500 에러 패턴

### 1. ExcelJS 관련
```
Cannot find module 'exceljs'
→ npm install -g exceljs
```

### 2. Credential 관련
```
No credentials found
→ OpenAI Credential 설정
```

### 3. Binary 관련
```
Cannot read property 'data' of undefined
→ Binary 데이터 전달 확인
```

### 4. Sheet 이름
```
Sheet 'Requirements' not found
→ Excel 파일의 시트명 확인
```

### 5. Memory 부족
```
JavaScript heap out of memory
→ n8n 메모리 제한 증가
```

---

## 긴급 연락처

**에러 메시지를 확인한 후** 다음 정보를 공유해주세요:

1. 에러 발생 노드 이름
2. 전체 에러 메시지
3. n8n 버전 (Settings → About)
4. Node.js 버전 (서버에서 `node -v`)

그러면 정확한 해결책을 바로 드릴 수 있습니다!

---

## 요약

**지금 해야 할 일**:
1. ✅ http://54.116.8.155:5678/executions 접속
2. ✅ 빨간 X 표시 실행 클릭
3. ✅ 에러 노드와 메시지 확인
4. ✅ 에러 메시지 공유

**가장 가능성 높은 원인**:
- ExcelJS 모듈 미설치 (90%)
- OpenAI Credential 미설정 (5%)
- 기타 (5%)
