# ExcelJS 모듈 Disallowed 에러 해결

## 에러 원인

```
Module 'exceljs' is disallowed [line 1]
```

**n8n 2.0 버전부터 보안상의 이유로 Code 노드에서 외부 모듈 require 불가**

### 왜 막혔나?

n8n 2.0+에서는 `@n8n/task-runner`를 사용하여 Code 노드를 샌드박스 환경에서 실행합니다. 보안을 위해 허용된 모듈만 사용 가능합니다.

**허용된 모듈**:
- 기본 Node.js 모듈 (fs, path, crypto 등)
- n8n 내장 모듈

**차단된 모듈**:
- ❌ exceljs
- ❌ xlsx
- ❌ 대부분의 npm 패키지

---

## 해결 방법

### 방법 1: JSON 응답만 반환 (권장)

Excel 파일 생성을 포기하고 **JSON 데이터만 반환**합니다.

**새 워크플로우**: `BRD_to_SDR_Workflow_JSONOnly.json`

**장점**:
- ✅ ExcelJS 불필요
- ✅ 빠른 응답
- ✅ 에러 없음

**단점**:
- ❌ Excel 파일 자동 생성 안 됨
- ⚠️ 사용자가 JSON을 Excel로 수동 변환 필요

**응답 예시**:
```json
{
  "success": true,
  "message": "SDR generation complete",
  "clientName": "eCommerce_Client_A",
  "stats": {
    "evars": 42,
    "props": 28,
    "events": 19
  },
  "sdr": {
    "evars": [
      {
        "Requirement ID": "REQ-001",
        "Analytics Variable": "eVar1",
        "Business Name": "Pagename",
        ...
      }
    ],
    "props": [...],
    "events": [...]
  }
}
```

**사용자는**:
1. JSON 응답 받기
2. 수동으로 Excel에 복사/붙여넣기
3. 또는 JSON을 Excel로 변환하는 별도 도구 사용

---

### 방법 2: Execute Command 노드로 Python 스크립트 실행

Python의 `openpyxl`을 사용하여 Excel 파일 생성

**필요 사항**:
- n8n 서버에 Python 설치
- openpyxl 패키지 설치

**장점**:
- ✅ Excel 파일 생성 가능
- ✅ n8n 제약 우회

**단점**:
- ❌ 복잡한 설정
- ❌ Python 스크립트 별도 관리 필요
- ❌ 서버 권한 필요

**구현 예시**:

1. **Python 스크립트 작성** (`/tmp/write_sdr.py`)
```python
import json
import sys
from openpyxl import load_workbook

# Read input from stdin
input_data = json.loads(sys.stdin.read())
client_name = input_data['clientName']
sdr_data = input_data['sdrData']
input_file = input_data['inputFile']

# Load workbook
wb = load_workbook(input_file)

# Write eVars
ws_evars = wb['eVars']
row = 7
for evar in sdr_data['evars']:
    ws_evars.cell(row, 2).value = evar.get('Requirement ID', '')
    ws_evars.cell(row, 3).value = evar.get('Analytics Variable', '')
    # ... more columns
    row += 1

# Save
output_file = f"/tmp/SDR_{client_name}.xlsx"
wb.save(output_file)
print(output_file)
```

2. **Execute Command 노드**
```bash
python3 /tmp/write_sdr.py
```

---

### 방법 3: n8n 커스텀 노드 개발

n8n 커스텀 노드로 ExcelJS 기능을 패키징

**필요 사항**:
- TypeScript 개발 능력
- n8n 커스텀 노드 개발 지식

**장점**:
- ✅ 완전한 기능
- ✅ 재사용 가능

**단점**:
- ❌ 개발 시간 필요
- ❌ n8n 버전 업데이트 시 유지보수

---

### 방법 4: n8n Community Node 사용

n8n Community Nodes에서 Excel 관련 노드 검색

https://www.npmjs.com/search?q=n8n-nodes-

**가능한 노드**:
- n8n-nodes-excel
- n8n-nodes-spreadsheet

**설치**:
```bash
# n8n Community Nodes 설치
npm install -g n8n-nodes-excel
```

**단점**:
- ⚠️ 적합한 노드가 없을 수 있음
- ⚠️ 유지보수 상태 불확실

---

## 권장 솔루션: JSON 응답 + 외부 처리

### 워크플로우

1. **n8n**: BRD 분석 → SDR JSON 생성 → JSON 응답
2. **외부 처리**: JSON을 받아서 Excel로 변환

### 옵션 A: 클라이언트에서 처리

**HTML 페이지에 JavaScript 추가**:

```javascript
// JSON 응답 받기
const response = await fetch(webhookUrl, { ... });
const jsonData = await response.json();

// Excel 생성 (SheetJS 라이브러리 사용)
const XLSX = require('xlsx');
const wb = XLSX.utils.book_new();

// eVars 시트
const ws_evars = XLSX.utils.json_to_sheet(jsonData.sdr.evars);
XLSX.utils.book_append_sheet(wb, ws_evars, 'eVars');

// Props 시트
const ws_props = XLSX.utils.json_to_sheet(jsonData.sdr.props);
XLSX.utils.book_append_sheet(wb, ws_props, 'Props');

// Events 시트
const ws_events = XLSX.utils.json_to_sheet(jsonData.sdr.events);
XLSX.utils.book_append_sheet(wb, ws_events, 'Events');

// 다운로드
XLSX.writeFile(wb, 'SDR_Output.xlsx');
```

### 옵션 B: 별도 마이크로서비스

**아키텍처**:
```
Browser → n8n Webhook → JSON 응답
          ↓
Browser → Excel 생성 서비스 → Excel 파일
```

**Excel 생성 서비스** (Node.js + Express):
```javascript
const express = require('express');
const ExcelJS = require('exceljs');

app.post('/generate-excel', async (req, res) => {
  const { sdrData, clientName } = req.body;

  const workbook = new ExcelJS.Workbook();
  // ... Excel 생성 로직

  res.setHeader('Content-Disposition', `attachment; filename=SDR_${clientName}.xlsx`);
  await workbook.xlsx.write(res);
});
```

---

## 즉시 사용 가능한 해결책

### BRD_to_SDR_Workflow_JSONOnly.json

**특징**:
- ✅ ExcelJS 불필요
- ✅ 모든 SDR 데이터를 JSON으로 반환
- ✅ 즉시 사용 가능

**설치**:
1. n8n → Import → `BRD_to_SDR_Workflow_JSONOnly.json`
2. OpenAI Credential 설정
3. Active ON

**Webhook URL**:
```
http://54.116.8.155:5678/webhook/brd-sdr-json
```

**응답**:
```json
{
  "success": true,
  "clientName": "eCommerce_Client_A",
  "stats": { "evars": 42, "props": 28, "events": 19 },
  "sdr": {
    "evars": [...],  // 모든 eVar 데이터
    "props": [...],  // 모든 Prop 데이터
    "events": [...]  // 모든 Event 데이터
  },
  "note": "Use this JSON to populate your Excel file"
}
```

**Excel 생성 방법**:

#### 수동 방법
1. JSON 응답 복사
2. Excel 파일 열기
3. eVars/Props/Events 시트에 데이터 붙여넣기

#### 자동 방법 (Python 스크립트)
```python
import json
import requests
from openpyxl import load_workbook

# 1. n8n에서 JSON 받기
response = requests.post('http://54.116.8.155:5678/webhook/brd-sdr-json', json={
    'clientName': 'Client',
    'fileData': 'base64...'
})
result = response.json()

# 2. 원본 Excel 파일 로드
wb = load_workbook('template.xlsx')

# 3. SDR 데이터 쓰기
ws_evars = wb['eVars']
for i, evar in enumerate(result['sdr']['evars'], start=7):
    ws_evars.cell(i, 2).value = evar['Requirement ID']
    ws_evars.cell(i, 3).value = evar['Analytics Variable']
    # ...

# 4. 저장
wb.save(f"SDR_{result['clientName']}.xlsx")
```

---

## 비교

| 방법 | 복잡도 | 즉시 사용 | Excel 생성 | 권장 |
|------|--------|-----------|-----------|------|
| **JSON 응답** | ⭐ 낮음 | ✅ | ❌ 수동 | ✅ **권장** |
| Python 스크립트 | ⭐⭐ 중간 | ⚠️ | ✅ | ⚠️ |
| 커스텀 노드 | ⭐⭐⭐ 높음 | ❌ | ✅ | ❌ |
| 클라이언트 처리 | ⭐⭐ 중간 | ⚠️ | ✅ | ✅ **권장** |

---

## 결론

**단기 해결책**: `BRD_to_SDR_Workflow_JSONOnly.json` 사용
- JSON 응답 받기
- 수동 또는 Python 스크립트로 Excel 생성

**장기 해결책**: 브라우저에서 SheetJS로 Excel 생성
- n8n은 JSON만 반환
- HTML 페이지에서 SheetJS 사용하여 Excel 다운로드

**지금 바로 사용**:
```bash
# 워크플로우 임포트
BRD_to_SDR_Workflow_JSONOnly.json

# 테스트
curl -X POST http://54.116.8.155:5678/webhook/brd-sdr-json \
  -H 'Content-Type: application/json' \
  -d '{"clientName":"Test","fileData":"..."}'
```

JSON 응답을 받아서 Excel로 변환하는 것은 사용자 측에서 처리하면 됩니다!
