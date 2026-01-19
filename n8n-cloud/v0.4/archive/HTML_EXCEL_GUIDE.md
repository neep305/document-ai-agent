# HTML + SheetJS 자동 Excel 생성 가이드

## 완성! 🎉

**설치 없이 브라우저에서 자동으로 Excel 파일을 생성합니다.**

**파일**: `upload_with_excel_download.html`

---

## 특징

### ✅ 완전 자동화
1. Excel 파일 업로드
2. n8n Webhook 호출 (AI 처리 30-60초)
3. **Excel 파일 자동 다운로드** ⭐

### ✅ 설치 불필요
- Python 설치 ❌
- npm/pip 설치 ❌
- 브라우저만 있으면 OK ✅

### ✅ 안전
- 모든 처리가 브라우저에서 진행
- 데이터가 외부로 나가지 않음
- SheetJS는 CDN에서 로드

---

## 사용 방법

### Step 1: HTML 파일 열기

```bash
# 브라우저에서 열기
open /Users/jason/dev/ai/document-ai-agent/n8n-cloud/v0.3/upload_with_excel_download.html

# 또는 더블클릭
```

### Step 2: 정보 입력

1. **Webhook URL** (이미 입력되어 있음)
   ```
   http://54.116.8.155:5678/webhook/brd-sdr-json
   ```

2. **Client Name**
   ```
   eCommerce Client A
   ```

3. **BRD Excel File**
   - 클릭하거나 드래그 앤 드롭
   - `AA_BRD_SDR_Test_01122026.xlsx` 선택

### Step 3: Generate SDR Excel 클릭

**진행 과정**:
```
[10%] Converting file to base64...
[20%] Uploading to n8n webhook...
[30%] AI is analyzing requirements... (30-60 seconds)
[80%] Generating Excel file...
[100%] Complete!
```

### Step 4: Excel 파일 자동 다운로드

파일명: `SDR_eCommerce_Client_A_2026-01-14.xlsx`

**자동으로 다운로드 폴더에 저장됩니다!**

---

## 화면 구성

### 상단
- 제목: "BRD to SDR Converter"
- 배지: "Auto Excel" (초록색)
- 정보 박스: "Excel file will be generated automatically"

### 폼
1. **Webhook URL** (입력 필드)
2. **Client Name** (입력 필드)
3. **BRD Excel File** (파일 업로드 영역)
   - 드래그 앤 드롭 가능
   - 클릭해서 선택 가능

### 진행 표시
- **Progress Bar**: 0% → 100%
- **Progress Text**: 현재 단계 표시

### 결과
- **성공 메시지** (초록색 박스)
  ```
  ✅ Success! Excel file downloaded.

  Statistics:
  - eVars: 42
  - Props: 28
  - Events: 19
  - Total: 89
  ```

---

## 생성되는 Excel 파일

### 시트 구성

1. **eVars 시트**
   - Requirement ID
   - Analytics Variable
   - Business Name
   - Business Description
   - Expected Values
   - Implementation Trigger
   - Example Value
   - Additional Notes

2. **Props 시트**
   - 동일한 컬럼 구조

3. **Events 시트**
   - 동일한 컬럼 구조

### 데이터
- AI가 생성한 모든 SDR 데이터
- 헤더 포함
- 즉시 사용 가능

---

## 기술 스택

### SheetJS (xlsx.full.min.js)
- CDN: `https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js`
- 버전: 0.20.1
- 기능: Excel 파일 생성 및 다운로드

### JavaScript API
```javascript
// Workbook 생성
const wb = XLSX.utils.book_new();

// JSON을 Sheet로 변환
const ws = XLSX.utils.json_to_sheet(data);

// Sheet를 Workbook에 추가
XLSX.utils.book_append_sheet(wb, ws, 'SheetName');

// Excel 파일 다운로드
XLSX.writeFile(wb, 'filename.xlsx');
```

---

## 장점

### vs Python 스크립트
| 항목 | Python | HTML + SheetJS |
|------|--------|----------------|
| 설치 | pip install | ❌ 불필요 |
| 실행 | 터미널 | ✅ 브라우저 |
| 사용성 | CLI | ✅ GUI |
| 자동화 | 스크립트 | ✅ 클릭 한 번 |

### vs 수동 복사
| 항목 | 수동 복사 | HTML + SheetJS |
|------|----------|----------------|
| 시간 | 5-10분 | ✅ 자동 (1초) |
| 에러 | 복사 실수 | ✅ 없음 |
| 반복 작업 | 매번 | ✅ 자동 |

---

## 작동 원리

### 전체 플로우

```
1. 사용자가 Excel 파일 선택
   ↓
2. JavaScript가 파일을 Base64로 변환
   ↓
3. n8n Webhook에 POST 요청
   {
     clientName: "...",
     fileData: "base64..."
   }
   ↓
4. n8n이 AI로 SDR 생성 (30-60초)
   ↓
5. JSON 응답 수신
   {
     success: true,
     sdr: {
       evars: [...],
       props: [...],
       events: [...]
     },
     stats: {...}
   }
   ↓
6. SheetJS가 JSON → Excel 변환
   ↓
7. 브라우저가 Excel 파일 다운로드
   ✅ SDR_Client_2026-01-14.xlsx
```

### 코드 하이라이트

**Base64 변환**:
```javascript
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.readAsDataURL(file);
    });
}
```

**Excel 생성**:
```javascript
const wb = XLSX.utils.book_new();

const ws_evars = XLSX.utils.json_to_sheet(result.sdr.evars);
XLSX.utils.book_append_sheet(wb, ws_evars, 'eVars');

const ws_props = XLSX.utils.json_to_sheet(result.sdr.props);
XLSX.utils.book_append_sheet(wb, ws_props, 'Props');

const ws_events = XLSX.utils.json_to_sheet(result.sdr.events);
XLSX.utils.book_append_sheet(wb, ws_events, 'Events');

XLSX.writeFile(wb, filename);
```

---

## 커스터마이징

### Webhook URL 변경

HTML 파일에서 기본값 수정:
```html
<input
    type="text"
    id="webhookUrl"
    value="http://your-server.com/webhook/brd-sdr-json"
>
```

### 스타일 변경

CSS 섹션에서 색상 수정:
```css
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
/* 원하는 그라데이션으로 변경 */
```

### 파일명 형식 변경

JavaScript에서 수정:
```javascript
const filename = `SDR_${safeClientName}_${timestamp}.xlsx`;
// 원하는 형식으로 변경
```

---

## 트러블슈팅

### 문제 1: Excel 다운로드 안 됨

**원인**: 브라우저가 다운로드를 차단

**해결**:
1. 브라우저 설정 → 다운로드 → 자동 다운로드 허용
2. 팝업 차단 해제

### 문제 2: CORS 에러

**증상**:
```
Access to fetch blocked by CORS policy
```

**원인**: 브라우저가 file:// 프로토콜에서 실행됨

**해결**:
1. 간단한 웹 서버 실행:
   ```bash
   cd /Users/jason/dev/ai/document-ai-agent/n8n-cloud/v0.3
   python3 -m http.server 8000
   ```

2. 브라우저에서 접속:
   ```
   http://localhost:8000/upload_with_excel_download.html
   ```

### 문제 3: SheetJS 로드 실패

**증상**: "XLSX is not defined"

**원인**: CDN에서 라이브러리 로드 실패

**해결**:
1. 인터넷 연결 확인
2. 또는 로컬에 SheetJS 다운로드:
   ```html
   <script src="./xlsx.full.min.js"></script>
   ```

---

## 성능

### 처리 시간
| 단계 | 시간 |
|------|------|
| 파일 선택 | ~1초 |
| Base64 변환 | ~1초 |
| Webhook 호출 | ~1초 |
| AI 처리 (n8n) | 30-60초 |
| Excel 생성 | ~1초 |
| 다운로드 | ~1초 |
| **총** | **35-65초** |

### 파일 크기
- 업로드: 원본 Excel (245 KB)
- 다운로드: 완성된 SDR (약 100-200 KB)

---

## 배포

### 로컬 사용
```bash
# 파일 더블클릭 또는
open upload_with_excel_download.html
```

### 웹 서버 배포
```bash
# 간단한 HTTP 서버
python3 -m http.server 8000

# 또는 nginx/apache에 배포
```

### 클라우드 배포
- GitHub Pages
- Netlify
- Vercel
- AWS S3 + CloudFront

단순 HTML 파일이므로 **어디든 배포 가능**!

---

## 다음 단계

### 개선 아이디어

1. **Requirements 시트도 포함**
   - 원본 Requirements 시트를 유지

2. **진행률 더 상세하게**
   - AI 처리 중 실시간 상태 표시

3. **에러 처리 강화**
   - 재시도 버튼
   - 에러 로그 다운로드

4. **배치 처리**
   - 여러 파일 한 번에 업로드

---

## 요약

### 사용 방법
1. **HTML 파일 열기**
2. **Excel 파일 선택**
3. **Generate SDR Excel 클릭**
4. **30-60초 대기**
5. **Excel 자동 다운로드** ✅

### 장점
- ✅ 설치 불필요
- ✅ 완전 자동화
- ✅ 브라우저만 있으면 OK
- ✅ 안전 (로컬 처리)

### 파일
- **입력**: BRD Excel (Requirements 작성됨)
- **출력**: SDR Excel (eVars/Props/Events 완성됨)

**이제 클릭 한 번으로 BRD → SDR 변환 완료!** 🎉
