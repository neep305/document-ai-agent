# BRD to SDR - Excel Write v0.5 Implementation Guide

## 🎯 Overview

**Version 0.5**은 서버 측에서 원본 Excel 파일을 복제하고, ExcelJS를 사용하여 AI 생성 데이터를 B7 셀부터 작성하는 방식으로 구현되었습니다.

### 주요 개선사항

**v0.4 (이전 버전)**:
- ❌ 브라우저 메모리에서 Excel 생성 (SheetJS)
- ❌ 원본 템플릿 손실 (이미지, 스타일, 수식 등)
- ❌ JSON 응답 후 브라우저에서 재조립

**v0.5 (현재 버전)**:
- ✅ n8n 서버에서 원본 파일 복제 및 처리
- ✅ ExcelJS로 원본 템플릿 완전 보존
- ✅ B6 헤더 유지, B7부터 데이터 작성
- ✅ 완성된 Excel 파일 직접 다운로드

---

## 📋 Files

### 1. n8n Workflow
**File**: `BRD to SDR - Excel Write v0.5.json`

**Nodes (12개)**:
```
Webhook Trigger
  ↓
Extract and Validate
  ↓
Create Binary (base64 → binary)
  ↓
Read Requirements Sheet
  ↓
Parse Requirements
  ↓
SDR Agent (AI) ← Tools + GPT-4o
  ↓
Parse SDR Output
  ↓
Write to Excel with ExcelJS ⭐ NEW
  ↓
Respond with Excel File ⭐ NEW
```

### 2. HTML Client
**File**: `upload_excel_v05.html`

**Changes**:
- Excel 생성 로직 제거 (SheetJS 불필요)
- Binary blob 응답 처리 추가
- 자동 파일 다운로드

---

## 🔧 Installation

### Step 1: n8n에 ExcelJS 설치

n8n Docker 컨테이너에 ExcelJS를 설치해야 합니다:

```bash
# Docker 컨테이너 접속
docker exec -it n8n sh

# ExcelJS 설치
npm install exceljs

# 컨테이너 재시작
exit
docker restart n8n
```

### Step 2: Workflow Import

1. n8n Dashboard 접속
2. "Import from File" 클릭
3. `BRD to SDR - Excel Write v0.5.json` 선택
4. **OpenAI Credential 설정** 필요:
   - "OpenAI GPT-4o" 노드 클릭
   - Credentials 설정 (YOUR_CREDENTIAL_ID 교체)

### Step 3: Webhook URL 확인

Workflow 활성화 후:
1. "Webhook Trigger" 노드 클릭
2. **Production URL** 복사 (예: `https://your-n8n.com/webhook/brd-sdr-excel`)

### Step 4: HTML 파일 설정

`upload_excel_v05.html` 열기:
```html
<input
    type="text"
    id="webhookUrl"
    value="YOUR_WEBHOOK_URL_HERE"  <!-- 여기 수정 -->
>
```

---

## 💡 How It Works

### 1. File Upload (Browser)
```javascript
// Base64 인코딩
const base64 = await fileToBase64(selectedFile);

// n8n webhook 호출
fetch(webhookUrl, {
    method: 'POST',
    body: JSON.stringify({
        clientName: "eCommerce_Client_A",
        baseSheetName: "Requirements_v2",
        fileData: base64
    })
});
```

### 2. File Processing (n8n Server)

#### A. Original File Load
```javascript
const ExcelJS = require('exceljs');
const workbook = new ExcelJS.Workbook();
const buffer = Buffer.from(originalBinary.data, 'base64');
await workbook.xlsx.load(buffer);
```

#### B. Find Sheets
```javascript
const evarsSheet = workbook.worksheets.find(
    ws => ws.name.toLowerCase() === 'evars'
);
const propsSheet = workbook.worksheets.find(
    ws => ws.name.toLowerCase() === 'props'
);
const eventsSheet = workbook.worksheets.find(
    ws => ws.name.toLowerCase().includes('custom events')
);
```

#### C. Clear Old Data (Row 7+)
```javascript
function clearDataRows(worksheet, startRow = 7) {
    const rowCount = worksheet.rowCount;
    for (let i = rowCount; i >= startRow; i--) {
        worksheet.spliceRows(i, 1);
    }
}
```

#### D. Write New Data from B7
```javascript
function writeData(worksheet, data, columns) {
    clearDataRows(worksheet, 7);
    data.forEach((item, index) => {
        const rowNum = 7 + index;
        const row = worksheet.getRow(rowNum);
        columns.forEach((col, colIndex) => {
            // Column B = index 2
            row.getCell(2 + colIndex).value = item[col] || '';
        });
        row.commit();
    });
}

// Example: Write eVars
writeData(evarsSheet, sdrData.evars, [
    'Analytics Variable',
    'Variable Name',
    'eVar Allocation',
    'eVar Expiration',
    'eVar Merchandising'
]);
```

#### E. Return Binary File
```javascript
const outputBuffer = await workbook.xlsx.writeBuffer();
const base64Output = outputBuffer.toString('base64');

return [{
    binary: {
        data: {
            data: base64Output,
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            fileName: `SDR_${clientName}_${date}.xlsx`
        }
    }
}];
```

### 3. File Download (Browser)
```javascript
// Blob 응답 받기
const blob = await response.blob();

// 자동 다운로드
const url = window.URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `SDR_${clientName}_${date}.xlsx`;
a.click();
```

---

## 📊 Data Structure

### AI Output (JSON)
```json
{
  "evars": [
    {
      "Analytics Variable": "eVar1",
      "Variable Name": "Pagename",
      "eVar Allocation": "Most Recent (Last)",
      "eVar Expiration": "Visit",
      "eVar Merchandising": "n/a"
    }
  ],
  "props": [
    {
      "Analytics Variable": "prop1",
      "Variable Name": "Pagename",
      "Example Value": "Homepage"
    }
  ],
  "events": [
    {
      "Event": "event1",
      "Event Name": "Custom Page View",
      "Event Description": "Tracks custom page views",
      "Event Type": "Counter"
    }
  ]
}
```

### Excel Layout
```
Row 1-5: Template header (logo, title, etc.)
Row 6:   Column headers (A6: blank, B6: Analytics Variable, C6: Variable Name, ...)
Row 7+:  Data rows (AI generated)
```

---

## 🧪 Testing

### Test Case 1: Basic Workflow
```bash
# 1. Upload sample file
File: AA_BRD_SDR_Test_01122026.xlsx
Client: TestClient_001
Sheet: Requirements_v2

# 2. Expected output
File: SDR_TestClient_001_2026-01-19.xlsx
- eVars sheet: 11 rows (B7-B17)
- Props sheet: 8 rows (B7-B14)
- Events sheet: 10 rows (B7-B16)
```

### Test Case 2: Template Preservation
```bash
# Verify original template intact
- Row 1-6: Unchanged
- Images: Preserved
- Cell styles: Preserved
- Column widths: Preserved
- Formulas (if any): Preserved
```

### Test Case 3: Error Handling
```bash
# Missing file
→ Error: "Please select an Excel file"

# Missing baseSheetName
→ Error: "Missing required fields"

# Invalid AI output
→ Error: "Failed to parse SDR output"
```

---

## 🐛 Troubleshooting

### Error: "ExcelJS is not defined"
```bash
# ExcelJS 미설치
docker exec -it n8n npm install exceljs
docker restart n8n
```

### Error: "Cannot find sheet 'evars'"
```bash
# 시트 이름 대소문자 확인
# 코드는 case-insensitive 검색하지만 공백 주의
Sheet name: "eVars" ✅
Sheet name: " eVars " ❌ (공백)
```

### Error: "Binary data not found"
```bash
# 'Create Binary' 노드 참조 확인
$('Create Binary').first().binary.file
```

### File download fails in browser
```bash
# CORS 이슈 확인
# n8n webhook는 기본적으로 CORS 허용
# 하지만 reverse proxy 사용 시 설정 필요
```

---

## 🔄 Migration from v0.4

### Changes Required

1. **Workflow**:
   - Import new v0.5 JSON
   - Replace old "Final Response" node
   - Add "Write to Excel with ExcelJS" node
   - Add "Respond with Excel File" node

2. **HTML**:
   - Remove SheetJS library
   - Remove `generateExcelFile()` function
   - Change response handling to blob
   - Update download logic

3. **Dependencies**:
   - n8n: Install ExcelJS
   - Browser: No dependencies needed

---

## 📈 Performance

### Comparison

| Metric | v0.4 | v0.5 |
|--------|------|------|
| File size | Smaller (no styles) | Original size |
| Template preservation | ❌ Lost | ✅ Preserved |
| Processing location | Browser | Server |
| Download time | Fast (JSON) | Medium (Excel) |
| Network traffic | Low (JSON) | Medium (Binary) |
| Quality | Low | High |

### Recommendations

- Use v0.5 for production (template preservation)
- Use v0.4 for testing (faster iteration)

---

## 🔐 Security

### File Handling
- Original file never saved to disk
- Processed in memory only
- Automatic cleanup after response

### Data Privacy
- Base64 transmission (HTTPS required)
- No file storage on server
- No logging of sensitive data

---

## 📚 References

- [ExcelJS Documentation](https://github.com/exceljs/exceljs)
- [n8n Code Node](https://docs.n8n.io/code-examples/)
- [Adobe Analytics Variables](https://experienceleague.adobe.com/en/docs/analytics/implementation/vars/page-vars/evar)

---

## 🆘 Support

### Logs
```bash
# n8n execution logs
n8n Dashboard → Executions → Click execution → View details

# Docker logs
docker logs -f n8n
```

### Debug Mode
```javascript
// Add to Code node
console.log('Debug:', JSON.stringify(data, null, 2));
```
