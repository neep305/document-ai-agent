# ⚡ UV로 빠르게 시작하기

UV를 사용하면 가상환경 생성부터 패키지 설치까지 한번에 처리됩니다.

## 🚀 빠른 시작 (3단계)

### 1️⃣ UV 설치 (처음 한번만)

```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows (PowerShell)
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
```

### 2️⃣ 환경변수 설정

```bash
# .env 파일 생성
cp .env.example .env

# .env 파일 편집
# OPENAI_API_KEY=sk-proj-your-actual-key-here
# OPENAI_MODEL=gpt-4o
```

### 3️⃣ 실행!

```bash
# 첫 실행 시 자동으로 venv 생성 + 패키지 설치 + 실행
uv run python run_sample.py
```

끝! 🎉

---

## 📝 UV 명령어 참고

### 패키지 설치/업데이트

```bash
# 모든 의존성 설치 (pyproject.toml 기준)
uv sync

# 특정 패키지 추가
uv add <package-name>

# 개발 의존성 추가
uv add --dev <package-name>

# 패키지 제거
uv remove <package-name>

# 모든 패키지 재설치
uv sync --reinstall
```

### 프로젝트 실행

```bash
# 스크립트 직접 실행 (venv 자동 활성화)
uv run python run_sample.py

# 또는 venv 수동 활성화
source .venv/bin/activate  # macOS/Linux
# .venv\Scripts\activate   # Windows
python run_sample.py
```

### 유용한 명령어

```bash
# Python 버전 확인
uv python list

# 설치된 패키지 확인
uv pip list

# 프로젝트 정보 확인
uv tree
```

---

## 🆚 UV vs pip 비교

| 작업 | pip | UV |
|------|-----|-----|
| 가상환경 생성 | `python -m venv venv` | (자동) |
| 가상환경 활성화 | `source venv/bin/activate` | (자동) |
| 패키지 설치 | `pip install -r requirements.txt` | `uv sync` |
| 실행 | `python script.py` | `uv run python script.py` |
| **총 명령어** | **3개** | **1개** |
| **속도** | 느림 | **10-100배 빠름** ⚡ |

---

## 💡 왜 UV를 사용하나요?

✅ **엄청 빠름**: Rust로 작성되어 pip보다 10-100배 빠름
✅ **자동화**: venv 생성/활성화 자동
✅ **의존성 관리**: pyproject.toml 기반 현대적 관리
✅ **호환성**: pip과 100% 호환
✅ **간편함**: 명령어가 훨씬 적음

---

## 🔧 트러블슈팅

### "uv: command not found"
```bash
# PATH에 uv 추가
export PATH="$HOME/.cargo/bin:$PATH"

# 또는 재설치
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### "OPENAI_API_KEY not found"
```bash
# .env 파일 확인
cat .env

# 또는 직접 설정
export OPENAI_API_KEY="your-key"
```

### 패키지 설치 오류
```bash
# 캐시 삭제 후 재설치
uv cache clean
uv sync --reinstall
```

---

## 📚 더 알아보기

- [UV 공식 문서](https://docs.astral.sh/uv/)
- [UV GitHub](https://github.com/astral-sh/uv)
- [프로젝트 README](README.md)
