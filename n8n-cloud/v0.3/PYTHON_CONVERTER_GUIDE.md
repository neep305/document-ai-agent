# Python JSON to Excel Converter 사용 가이드

## 개요

n8n 워크플로우가 JSON으로 SDR 데이터를 반환하면, 이 Python 스크립트가 자동으로 Excel 파일을 생성합니다.

**파일**: `json_to_excel.py`

---

## 사전 준비

### 1. Python 설치 확인

```bash
python3 --version
# Python 3.7 이상 필요
```

### 2. 필요한 패키지 설치

```bash
pip3 install requests openpyxl
```

**설치 확인**:
```bash
python3 -c "import requests, openpyxl; print('✅ All packages installed')"
```

---

## 사용 방법

### 기본 사용법

```bash
python3 json_to_excel.py \
  --input AA_BRD_SDR_Test_01122026.xlsx \
  --client "eCommerce Client A"
```

### 전체 옵션

```bash
python3 json_to_excel.py \
  --input <입력_파일.xlsx> \
  --client "<클라이언트명>" \
  --output <출력_파일.xlsx> \
  --webhook <웹훅_URL>
```

### 파라미터

| 파라미터 | 필수 | 설명 | 기본값 |
|---------|------|------|--------|
| `--input`, `-i` | ✅ | 입력 Excel 파일 (BRD) | - |
| `--client`, `-c` | ✅ | 클라이언트명 | - |
| `--output`, `-o` | ❌ | 출력 Excel 파일명 | `SDR_<client>_<date>.xlsx` |
| `--webhook`, `-w` | ❌ | n8n Webhook URL | `http://54.116.8.155:5678/webhook/brd-sdr-json` |

---

## 실행 예시

### 예시 1: 기본 사용

```bash
cd /Users/jason/dev/ai/document-ai-agent/n8n-cloud/v0.3

python3 json_to_excel.py \
  --input AA_BRD_SDR_Test_01122026.xlsx \
  --client "eCommerce Client A"
```

**출력**:
```
============================================================
🚀 BRD to SDR - JSON to Excel Converter
============================================================
Input file: AA_BRD_SDR_Test_01122026.xlsx
Client: eCommerce Client A
Output file: SDR_eCommerce_Client_A_20260114.xlsx
Webhook: http://54.116.8.155:5678/webhook/brd-sdr-json
============================================================

📂 Reading file: AA_BRD_SDR_Test_01122026.xlsx
✅ File read successfully (245.8 KB)
📊 Base64 length: 337152 characters

🌐 Calling n8n webhook...
   URL: http://54.116.8.155:5678/webhook/brd-sdr-json
   Client: eCommerce Client A

⏳ Please wait 30-60 seconds for AI processing...

📥 Response status: 200
✅ Webhook call successful
📊 Stats: {'evars': 42, 'props': 28, 'events': 19}

📝 Writing SDR data to Excel...
   Input: AA_BRD_SDR_Test_01122026.xlsx
   Output: SDR_eCommerce_Client_A_20260114.xlsx
   Writing eVars...
   ✅ Wrote 42 eVars
   Writing Props...
   ✅ Wrote 28 Props
   Writing Events...
   ✅ Wrote 19 Events

✅ Excel file saved: SDR_eCommerce_Client_A_20260114.xlsx

============================================================
🎉 SUCCESS!
============================================================
📄 Output file: SDR_eCommerce_Client_A_20260114.xlsx
📊 Statistics:
   - eVars: 42
   - Props: 28
   - Events: 19
   - Total: 89
============================================================
```

### 예시 2: 커스텀 출력 파일명

```bash
python3 json_to_excel.py \
  --input AA_BRD_SDR_Test_01122026.xlsx \
  --client "Test Client" \
  --output "My_Custom_SDR.xlsx"
```

### 예시 3: 다른 웹훅 URL 사용

```bash
python3 json_to_excel.py \
  --input AA_BRD_SDR_Test_01122026.xlsx \
  --client "Client X" \
  --webhook "http://localhost:5678/webhook/brd-sdr-json"
```

---

## 실행 과정

### Step 1: 파일 읽기
- Excel 파일을 읽어서 Base64로 인코딩
- 파일 크기 표시

### Step 2: n8n Webhook 호출
- JSON payload 전송
- 30-60초 대기 (AI 처리 시간)
- JSON 응답 수신

### Step 3: Excel 쓰기
- 원본 Excel 파일 로드
- eVars 시트에 데이터 쓰기 (row 7부터)
- Props 시트에 데이터 쓰기 (row 7부터)
- Events 시트에 데이터 쓰기 (row 7부터)
- 새 파일로 저장

---

## 에러 처리

### 에러 1: 패키지 없음

```
❌ Error: 'requests' module not found
Install: pip3 install requests
```

**해결**:
```bash
pip3 install requests openpyxl
```

### 에러 2: 파일 없음

```
FileNotFoundError: File not found: AA_BRD_SDR_Test_01122026.xlsx
```

**해결**:
- 파일 경로 확인
- 절대 경로 사용
```bash
python3 json_to_excel.py \
  --input /Users/jason/dev/ai/document-ai-agent/n8n-cloud/v0.3/AA_BRD_SDR_Test_01122026.xlsx \
  --client "Test"
```

### 에러 3: Webhook 연결 실패

```
❌ Request error: Connection refused
```

**해결**:
1. n8n 워크플로우 활성화 확인
2. Webhook URL 확인
3. 네트워크 연결 확인

### 에러 4: Timeout

```
❌ Request timeout (120 seconds)
```

**원인**: AI 처리 시간이 너무 오래 걸림

**해결**:
- 재시도
- n8n Executions에서 진행 상황 확인

### 에러 5: 시트 없음

```
ValueError: Required sheet 'eVars' not found in Excel file
```

**해결**:
- Excel 파일에 'eVars', 'Props', 'Events' 시트가 있는지 확인
- 올바른 템플릿 파일 사용

---

## 배치 처리

여러 파일을 한 번에 처리:

```bash
#!/bin/bash
# batch_process.sh

FILES=(
  "AA_BRD_SDR_Test_01122026.xlsx"
  "AA_BRD_SDR_Test_02.xlsx"
  "AA_BRD_SDR_Test_03.xlsx"
)

CLIENTS=(
  "eCommerce Client A"
  "Retail Client B"
  "Media Client C"
)

for i in "${!FILES[@]}"; do
  echo "Processing ${FILES[$i]}..."
  python3 json_to_excel.py \
    --input "${FILES[$i]}" \
    --client "${CLIENTS[$i]}"
  echo ""
done

echo "✅ All files processed!"
```

**실행**:
```bash
chmod +x batch_process.sh
./batch_process.sh
```

---

## 스크립트 기능

### 주요 함수

1. **`read_and_encode_file(file_path)`**
   - Excel 파일 읽기
   - Base64 인코딩
   - 파일 크기 검증

2. **`call_n8n_webhook(webhook_url, client_name, file_base64)`**
   - n8n Webhook 호출
   - JSON 응답 수신
   - 에러 처리

3. **`write_sdr_to_excel(input_file, sdr_data, output_file)`**
   - Excel 파일 로드
   - SDR 데이터 쓰기
   - 파일 저장

### 안전 기능

- ✅ 파일 존재 확인
- ✅ 필수 시트 검증
- ✅ JSON 응답 검증
- ✅ 타임아웃 처리 (120초)
- ✅ 에러 메시지 상세 출력
- ✅ Stack trace 표시

---

## 통합 워크플로우

### 전체 프로세스

```
1. BRD Excel 파일 준비
   ↓
2. Python 스크립트 실행
   ↓
3. 파일을 Base64로 인코딩
   ↓
4. n8n Webhook 호출
   ↓
5. n8n이 AI로 SDR 생성 (30-60초)
   ↓
6. JSON 응답 수신
   ↓
7. Excel 파일에 SDR 데이터 쓰기
   ↓
8. 완성된 SDR Excel 파일 저장
   ✅
```

### 한 줄 명령어

```bash
python3 json_to_excel.py -i AA_BRD_SDR_Test_01122026.xlsx -c "Client A"
```

---

## 고급 사용법

### 1. 스크립트를 PATH에 추가

```bash
# ~/.bashrc 또는 ~/.zshrc에 추가
export PATH="$PATH:/Users/jason/dev/ai/document-ai-agent/n8n-cloud/v0.3"

# 실행 권한 부여
chmod +x /Users/jason/dev/ai/document-ai-agent/n8n-cloud/v0.3/json_to_excel.py
```

그러면 어디서든:
```bash
json_to_excel.py -i myfile.xlsx -c "Client"
```

### 2. Alias 만들기

```bash
# ~/.bashrc 또는 ~/.zshrc에 추가
alias brd2sdr='python3 /Users/jason/dev/ai/document-ai-agent/n8n-cloud/v0.3/json_to_excel.py'
```

사용:
```bash
brd2sdr -i myfile.xlsx -c "Client"
```

### 3. 자동화 스크립트

특정 폴더를 감시하고 자동으로 처리:

```bash
#!/bin/bash
# watch_and_process.sh

WATCH_DIR="/Users/jason/brd_files"
CLIENT_NAME="Default Client"

while true; do
  for file in "$WATCH_DIR"/*.xlsx; do
    if [ -f "$file" ]; then
      echo "New file detected: $file"
      python3 json_to_excel.py -i "$file" -c "$CLIENT_NAME"
      mv "$file" "$WATCH_DIR/processed/"
    fi
  done
  sleep 10
done
```

---

## 성능

### 예상 실행 시간

| 단계 | 시간 |
|------|------|
| 파일 읽기 | ~1초 |
| Webhook 호출 | ~1초 |
| AI 처리 (n8n) | 30-60초 |
| Excel 쓰기 | ~2초 |
| **총** | **35-65초** |

### 비용

- Python 스크립트: 무료
- n8n 워크플로우: 무료 (self-hosted)
- OpenAI API: ~$0.30-0.50 per execution

---

## 체크리스트

### 설치
- [ ] Python 3.7+ 설치됨
- [ ] requests 패키지 설치됨
- [ ] openpyxl 패키지 설치됨
- [ ] n8n 워크플로우 활성화됨

### 실행 전
- [ ] BRD Excel 파일 준비됨
- [ ] Requirements 시트 작성 완료
- [ ] 클라이언트명 준비
- [ ] n8n Webhook URL 확인

### 실행 후
- [ ] 출력 파일 생성됨
- [ ] eVars 시트 데이터 확인
- [ ] Props 시트 데이터 확인
- [ ] Events 시트 데이터 확인
- [ ] 필수 변수 포함 확인

---

## 요약

**설치**:
```bash
pip3 install requests openpyxl
```

**실행**:
```bash
python3 json_to_excel.py \
  --input AA_BRD_SDR_Test_01122026.xlsx \
  --client "eCommerce Client A"
```

**결과**:
```
SDR_eCommerce_Client_A_20260114.xlsx
```

**시간**: 35-65초
**비용**: ~$0.30-0.50

간단하고 자동화되었습니다! 🎉
