# Project Name
Tagging AI

# Project 목적
프로젝트 시작 과정에서 기본적인 요구사항 정의서를 제공하면 이를 기반으로 문서를 자동으로 생성하여 업무에 소요되는 작성작업의 효율성을 높이는 것이 목적이다.

# 시스템 아키텍처

이 프로젝트는 **두 개의 독립적인 시스템**으로 구성되어 있습니다:

## 1. Python LangGraph 시스템 (프로그래밍 방식)

**목적**: 개발자/자동화 워크플로우를 위한 프로그래밍 방식 문서 생성

**구성 요소**:
- **진입점**: `run_sample.py`
- **핵심 엔진**: `src/workflows/brd_sdr_workflow.py` (LangGraph 기반)
- **출력 형식**: Markdown, JSON 파일
- **출력 위치**: `output/` 폴더

**사용 시나리오**:
- CI/CD 파이프라인 통합
- 대량 문서 자동 생성
- Python 스크립트 기반 워크플로우

**실행 방법**:
```bash
uv run python run_sample.py
```

## 2. n8n + webhook-service 시스템 (웹 UI 방식)

**목적**: 비기술 사용자를 위한 웹 기반 Excel 문서 생성

**구성 요소**:
- **프론트엔드**: `webhook-service/public/index.html` (파일 업로드 UI)
- **AI 처리**: n8n 워크플로우 (GPT-4o 기반 SDR 생성)
- **Excel 생성**: `webhook-service/server.js` (Node.js + ExcelJS)
- **출력 형식**: Excel 파일 (템플릿 서식 유지)
- **출력 위치**: `webhook-service/output/`

**데이터 흐름**:
```
HTML Form → n8n Webhook → AI Processing → JSON Response
    ↓
webhook-service /generate-excel → Excel File Download
```

**사용 시나리오**:
- 컨설턴트/비즈니스 사용자의 수동 작업
- Excel 템플릿 서식 보존이 필요한 경우
- 웹 브라우저에서 즉시 결과 다운로드

**실행 방법**:
```bash
cd webhook-service
npm install
npm start
# 브라우저에서 http://localhost:3000 접속
```

**중요**: 두 시스템은 **서로 통합되지 않으며**, 각각 다른 사용 사례를 제공합니다.

# 주요과정 정리

## 문서 생성 파이프라인

1) Tagging Requirement Document를 생성하고
2) 생성된 Tagging Requirement Document를 작성하면
3) AI에서 기본정보를 바탕으로 추론을 통해 Solution Design Document를 작성한다.
4) Technical Implementation Document 생성: Solution Design Document를 바탕으로 기술구현문서를 작성한다. 기술 구현사항은 OS별 요청사항에 따라 Web SDK, Android(Kotlin), iOS(Swift), Flutter 코드로 각각 작성한다. 예를 들어 Web(Javascript), Native(Flutter)로 요청하면 Web, Native 코드를 base-docs/3_tsd에 있는 document 내용에 맞게 작성한다.
5) 해당 기술을 바탕으로 사용자(또는 Consultant)가 Adobe Tag Creation을 완성하면 요청에 따라 Tag 관련 QA 작업을 수행한다.
6) 수행한 QA결과를 바탕으로 QA Report를 생성한다.

## 시스템 선택 가이드

| 요구사항 | 사용 시스템 |
|---------|------------|
| Python 자동화 스크립트 필요 | Python LangGraph 시스템 |
| Excel 템플릿 서식 유지 필요 | n8n + webhook-service 시스템 |
| CI/CD 파이프라인 통합 | Python LangGraph 시스템 |
| 비기술 사용자 웹 UI 필요 | n8n + webhook-service 시스템 |
| Markdown/JSON 출력 | Python LangGraph 시스템 |
| Excel 파일 출력 | n8n + webhook-service 시스템 |