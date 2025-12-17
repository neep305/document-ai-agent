# Project Name
Tagging AI

# Project 목적
프로젝트 시작 과정에서 기본적인 요구사항 정의서를 제공하면 이를 기반으로 문서를 자동으로 생성하여 업무에 소요되는 작성작업의 효율성을 높이는 것이 목적이다.

# 주요과정 정리
1) Tagging Requirement Document를 생성하고
2) 생성된 Tagging Requirement Document를 작성하면
3) AI에서 기본정보를 바탕으로 추론을 통해 Solution Design Document를 작성한다.
4) Technical Implementation Document 생성: Solution Design Document를 바탕으로 기술구현문서를 작성한다. 기술 구현사항은 OS별 요청사항에 따라 Web SDK, Android(Kotlin), iOS(Swift), Flutter 코드로 각각 작성한다. 예를 들어 Web(Javascript), Native(Flutter)로 요청하면 Web, Native 코드를 base-docs/3_tsd에 있는 document 내용에 맞게 작성한다.
5) 해당 기술을 바탕으로 사용자(또는 Consultant)가 Adobe Tag Creation을 완성하면 요청에 따라 Tag 관련 QA 작업을 수행한다.
6) 수행한 QA결과를 바탕으로 QA Report를 생성한다.