# 설치 없이 사용하는 방법

Python 설치 없이 Excel 파일을 생성하는 3가지 방법입니다.

---

## 방법 1: n8n Executions에서 수동 다운로드 (가장 간단)

### 과정

1. **n8n에서 JSON 워크플로우 실행**
   - `BRD_to_SDR_Workflow_JSONOnly.json` 사용
   - Webhook 호출

2. **n8n Executions 페이지 접속**
   ```
   http://54.116.8.155:5678/executions
   ```

3. **최근 실행 클릭**

4. **JSON 데이터 복사**
   - "Final Response" 노드 클릭
   - "Output" 탭
   - `sdr` 객체 복사

5. **Excel에 수동 붙여넣기**
   - 원본 Excel 파일 열기
   - `sdr.evars` 데이터 → eVars 시트에 붙여넣기
   - `sdr.props` 데이터 → Props 시트에 붙여넣기
   - `sdr.events` 데이터 → Events 시트에 붙여넣기

### 장점
- ✅ 아무것도 설치 안 해도 됨
- ✅ 바로 사용 가능

### 단점
- ⚠️ 수동 작업 필요 (5-10분)

---

## 방법 2: Google Sheets로 변환 후 Excel 다운로드

### 과정

1. **JSON 응답 받기**
   ```bash
   curl -X POST http://54.116.8.155:5678/webhook/brd-sdr-json \
     -H 'Content-Type: application/json' \
     -d '{"clientName":"Test","fileData":"..."}' \
     > sdr_result.json
   ```

2. **Google Sheets 열기**
   - https://sheets.google.com

3. **새 스프레드시트 생성**

4. **Apps Script 사용**
   - Extensions → Apps Script
   - 다음 코드 붙여넣기:

```javascript
function importSDRJson() {
  const jsonString = `여기에 JSON 붙여넣기`;
  const data = JSON.parse(jsonString);

  // eVars 시트
  const evarsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('eVars') ||
                     SpreadsheetApp.getActiveSpreadsheet().insertSheet('eVars');

  const evarsData = data.sdr.evars.map(evar => [
    evar['Requirement ID'],
    evar['Analytics Variable'],
    evar['Business Name'],
    evar['Business Description'],
    evar['Expected Values'],
    evar['Implementation Trigger'],
    evar['Example Value'],
    evar['Additional Notes']
  ]);

  evarsSheet.getRange(7, 2, evarsData.length, 8).setValues(evarsData);

  // Props, Events도 동일하게...
}
```

5. **Run → importSDRJson**

6. **File → Download → Microsoft Excel (.xlsx)**

### 장점
- ✅ 브라우저만 있으면 됨
- ✅ 무료

### 단점
- ⚠️ Apps Script 작성 필요
- ⚠️ 원본 Excel 템플릿 구조 재생성 필요

---

## 방법 3: 온라인 JSON to Excel 변환 도구

### 추천 도구

1. **ConvertCSV.com**
   - https://www.convertcsv.com/json-to-excel.htm
   - JSON 붙여넣기 → Excel 다운로드

2. **JSON to Excel Converter**
   - https://products.aspose.app/cells/conversion/json-to-xlsx

### 과정

1. **JSON 응답에서 각 배열 추출**
   ```json
   // evars.json
   [
     {"Requirement ID": "REQ-001", ...},
     ...
   ]
   ```

2. **온라인 도구에 붙여넣기**

3. **Excel 파일 다운로드**

4. **원본 Excel 템플릿에 복사**

### 장점
- ✅ 설치 불필요
- ✅ 간단함

### 단점
- ⚠️ 데이터 보안 (외부 사이트 사용)
- ⚠️ 시트별로 3번 반복 필요

---

## 방법 4: HTML 페이지로 브라우저에서 직접 Excel 생성

가장 **자동화되고 안전한** 방법입니다.

### upload_test.html 수정

HTML 테스트 페이지에 **SheetJS 라이브러리**를 추가하여 브라우저에서 직접 Excel 생성:

```html
<!DOCTYPE html>
<html>
<head>
    <script src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js"></script>
</head>
<body>
    <!-- 기존 폼 코드... -->

    <script>
    async function uploadAndConvert() {
        // 1. Webhook 호출
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({clientName, fileData})
        });

        const result = await response.json();

        // 2. Excel 생성
        const wb = XLSX.utils.book_new();

        // eVars 시트
        const ws_evars = XLSX.utils.json_to_sheet(result.sdr.evars);
        XLSX.utils.book_append_sheet(wb, ws_evars, 'eVars');

        // Props 시트
        const ws_props = XLSX.utils.json_to_sheet(result.sdr.props);
        XLSX.utils.book_append_sheet(wb, ws_props, 'Props');

        // Events 시트
        const ws_events = XLSX.utils.json_to_sheet(result.sdr.events);
        XLSX.utils.book_append_sheet(wb, ws_events, 'Events');

        // 3. 다운로드
        const fileName = `SDR_${result.clientName}_${result.timestamp}.xlsx`;
        XLSX.writeFile(wb, fileName);

        alert('✅ Excel file downloaded!');
    }
    </script>
</body>
</html>
```

### 장점
- ✅ 설치 불필요
- ✅ 완전 자동화
- ✅ 브라우저에서 직접 Excel 생성
- ✅ 안전 (데이터가 외부로 안 나감)

### 단점
- ⚠️ HTML 파일 수정 필요 (한 번만)

---

## 방법 5: curl + jq로 JSON 추출 후 CSV 변환

### 서버에서 실행 (설치 거의 없음)

```bash
# 1. JSON 받기
curl -X POST http://localhost:5678/webhook/brd-sdr-json \
  -H 'Content-Type: application/json' \
  -d '{"clientName":"Test","fileData":"'$(base64 -w0 < file.xlsx)'"}' \
  > result.json

# 2. jq로 CSV 변환 (jq는 보통 이미 설치되어 있음)
cat result.json | jq -r '.sdr.evars[] | [
  .["Requirement ID"],
  .["Analytics Variable"],
  .["Business Name"],
  .["Business Description"],
  .["Expected Values"],
  .["Implementation Trigger"],
  .["Example Value"],
  .["Additional Notes"]
] | @csv' > evars.csv

# 3. CSV를 Excel로 변환 (로컬에서)
# Excel 열기 → File → Import → CSV
```

### 장점
- ✅ jq만 있으면 됨 (대부분 서버에 이미 설치됨)
- ✅ Python 불필요

### 단점
- ⚠️ CSV → Excel 수동 변환 필요

---

## 추천 순서

### 즉시 사용 (설치 없음)
1. **방법 1: n8n Executions에서 수동 복사** ⭐ 가장 간단
2. **방법 3: 온라인 변환 도구**

### 최고의 사용자 경험
1. **방법 4: HTML + SheetJS** ⭐⭐⭐ 권장!

### 서버에서 자동화
1. **방법 5: curl + jq + CSV**

---

## 결론

**지금 당장 사용**: 방법 1 (n8n Executions에서 복사)

**장기 사용**: 방법 4 (HTML + SheetJS)
- 한 번 설정하면 계속 자동으로 Excel 다운로드
- 설치 불필요
- 완전 자동화

---

## 다음 단계

어떤 방법을 선호하시나요?

**A**: 방법 1 - n8n Executions에서 수동 복사 (지금 바로)
**B**: 방법 4 - HTML + SheetJS로 자동화 (제가 HTML 만들어드림)
**C**: Python 스크립트 사용 (가장 강력함, 설치 필요)

선택하시면 바로 진행하겠습니다!
