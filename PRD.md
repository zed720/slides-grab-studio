# PRD — Slides-Grab Web Studio

## 0. 문서 개요

* **제품명(가칭)**: Slides-Grab Web Studio
* **제품 유형**: 로컬 실행형 AI 슬라이드 생성·편집 웹 애플리케이션
* **기반 엔진**: `slides-grab`
* **주요 구현 방식**: Claude Code를 활용한 단계적 개발
* **문서 목적**: 기존 CLI 중심의 `slides-grab` 경험을 비개발자도 쉽게 사용할 수 있는 로컬 웹 제품으로 확장하기 위한 제품 요구사항 정의

---

## 0.1 기준 레포지토리

* **기반 레포지토리**: `NomaDamas/slides-grab`
* **레포 주소**: `https://github.com/NomaDamas/slides-grab`
* **제품 정의상 역할**: 본 프로젝트는 `slides-grab`을 대체하는 신규 슬라이드 엔진이 아니라, `slides-grab`의 생성·편집·검증·export 능력을 비개발자도 쓸 수 있게 만드는 **로컬 웹 제품 레이어**다.

## 0.2 현재 `slides-grab`의 핵심 기능 요약

`slides-grab`은 AI agent 친화적인 HTML/CSS 기반 슬라이드 제작 도구다. 저장소 설명상 주요 특성은 다음과 같다.

1. **HTML/CSS 슬라이드 구조**

    * 슬라이드가 `slide-*.html` 형태로 구성됨
    * 브라우저 렌더링과 AI 코드 수정 모두에 유리한 구조

2. **시각 선택 기반 편집**

    * 브라우저에서 수정할 영역을 드래그하여 선택
    * 선택한 영역을 맥락으로 agent에게 수정 요청 가능
    * 직접 텍스트 수정도 지원

3. **Plan → Design → Edit → Export 흐름**

    * Topic/files 기반 outline 구성
    * slide HTML 생성
    * browser editor에서 반복 수정
    * PDF 및 실험적 PPTX/Figma export

4. **CLI 기반 워크플로우**

    * `edit`, `build-viewer`, `validate`, `convert`, `figma`, `pdf`, `png`, `image`, `fetch-video`, `tldraw`, `list-templates`, `list-styles`, `preview-styles` 등 제공

5. **스타일과 템플릿 자산**

    * 번들 디자인 스타일 카탈로그 제공
    * agent가 미리 정의된 스타일을 선택하거나 커스텀 스타일을 생성 가능

6. **자산 계약(asset contract)**

    * 이미지/영상은 `<slides-dir>/assets/` 하위 로컬 파일 참조가 기본
    * 저장된 슬라이드에서 remote `http(s)` 이미지 URL 사용을 지양

## 0.3 이번 제품에서의 재사용 범위

### 그대로 재사용할 것

* HTML/CSS slide format
* 기존 deck 디렉터리 구조
* slide viewer/editor의 핵심 개념
* bbox selection 기반 edit UX
* validate/export 파이프라인
* 스타일/템플릿 체계의 개념

### 웹 제품 레이어에서 새로 만들 것

* 홈 대시보드
* 신규 deck 생성 wizard
* Claude Code 연결 상태 확인 UI
* 사용자별 기본 모델 및 작업 설정
* 프로젝트/덱 관리
* 수정 이력, revision timeline, rollback
* 회사 브랜드 테마와 정책 설정
* 에러 복구와 작업 상태 시각화

## 0.4 구현 판단의 기준

Claude Code 구현 시 아래 원칙을 따른다.

1. **slides-grab을 포크 후 확장하는 제품**으로 접근한다.
2. 기존 CLI와 editor가 이미 해결한 문제는 재구현하지 않는다.
3. 웹 UI는 `slides-grab`을 사용하는 사람이 터미널을 몰라도 되게 만드는 제품층이다.
4. deck 생성과 편집 경험을 하나의 연속 흐름으로 통합한다.
5. 롤백과 안전장치는 기존 레포의 기능을 넘어서는 핵심 차별화 요소로 본다.

# 1. 배경과 문제 정의

## 1.1 배경

`slides-grab`은 AI가 생성한 HTML/CSS 기반 슬라이드를 편집하고, 선택한 영역을 컨텍스트로 LLM에게 수정 요청을 보낼 수 있는 도구다. 또한 PDF, PPTX, Figma import용 PPTX 등으로 export할 수 있다.

현재 도구는 강력하지만, 핵심 워크플로우가 CLI 중심이라 사내 일반 사용자가 쓰기 어렵다.

## 1.2 해결하고 싶은 문제

### 문제 1. CLI 진입장벽

* 설치 이후에도 명령어를 직접 입력해야 함
* deck 디렉터리 구조를 이해해야 함
* export, validate, edit 실행 방법을 사용자가 외워야 함

### 문제 2. 생성부터 편집까지 흐름이 분리되어 있음

* deck 생성은 Claude Code / agent skill 흐름에 의존
* deck이 만들어진 뒤 편집기를 여는 구조라 초보자에게는 단절감이 있음

### 문제 3. 모델 연결과 실행 상태가 사용자 친화적이지 않음

* 사용자가 어떤 LLM이 연결돼 있는지 직관적으로 파악하기 어려움
* 연결 실패, 인증 누락, 모델별 지원 여부를 UI에서 쉽게 확인하기 어려움

### 문제 4. 수정 이력과 롤백이 부족함

* AI 편집은 빠르지만, 결과가 원치 않게 바뀔 수 있음
* “이전 상태 복구”, “슬라이드 단위 롤백”, “수정 전후 비교”가 필요함

### 문제 5. 회사용 커스터마이징이 없음

* 브랜드 컬러, 폰트, 템플릿, 기본 슬라이드 규칙을 강제하고 싶음
* 팀마다 공통 스타일을 재사용하고 싶음

---

# 2. 제품 비전

## 2.1 비전 문장

**터미널 없이도, 누구나 로컬 브라우저에서 AI와 대화하며 회사 스타일에 맞는 슬라이드를 생성·편집·복구·내보낼 수 있는 AI 프레젠테이션 스튜디오를 만든다.**

## 2.2 핵심 가치

1. **접근성**: 터미널을 모르는 사용자도 이용 가능
2. **생성력**: 대화만으로 deck 초안을 만들 수 있음
3. **편집성**: 기존 `slides-grab`의 bbox 기반 수정 경험을 유지
4. **안정성**: 롤백과 버전 히스토리 제공
5. **조직화**: 회사 테마, 템플릿, 정책을 반영

---

# 3. 목표와 비목표

## 3.1 제품 목표

### 목표 A. 웹 기반 시작점 제공

* 사용자가 로컬 URL 접속만으로 전체 기능을 시작할 수 있어야 함

### 목표 B. 덱 생성 → 편집 → export를 하나의 흐름으로 통합

* 대화로 deck 생성
* 생성된 deck을 바로 편집
* 최종 산출물 export

### 목표 C. LLM 연결 상태와 실행 가능성을 UI에서 확인

* Claude Code 연동 상태 확인
* Codex / 기타 provider 추가 확장 가능 구조

### 목표 D. 슬라이드 수정 이력 관리

* 수정 내역 기록
* 단계별 롤백
* 특정 slide만 복구

### 목표 E. 사내 커스터마이징 지원

* 공통 테마
* 브랜드 preset
* 템플릿 / guide prompt / export default 설정

## 3.2 비목표

초기 MVP에서는 아래를 하지 않는다.

* 실시간 멀티유저 공동편집
* 클라우드 SaaS 서비스화
* 완전한 PowerPoint 네이티브 편집기 대체
* 모바일 최적화
* 복잡한 권한 체계 및 조직 단위 계정관리
* 고급 애니메이션 타임라인 편집

---

# 4. 주요 사용자

## 4.1 Primary Persona — 사내 문서 작성자

* 비개발자
* 회사 소개서, 보고용 deck, 세일즈 deck, 행사 발표 자료 작성
* 디자인 전문가는 아니지만 “예쁘고 일관된 장표”를 원함

## 4.2 Secondary Persona — 기획자 / PM / 창업자

* 개념 정리, 초안 작성, 스토리라인 구성에 강점이 필요
* 빠르게 반복하고 여러 버전을 비교하고 싶음

## 4.3 Tertiary Persona — 사내 AI 파워유저 / 개발자

* Claude Code와 기존 `slides-grab`을 잘 사용함
* 더 편한 UI와 커스터마이징, 사내 배포성을 원함

---

# 5. 핵심 사용 시나리오

## 시나리오 1. 첫 접속과 초기 설정

1. 사용자가 로컬 URL 접속
2. 온보딩 화면 확인
3. 작업 폴더 선택 또는 기본 workspace 지정
4. 테마 preset 선택
5. Claude Code 연결 상태 확인
6. 사용할 기본 모델 선택
7. 설정 완료 후 홈으로 이동

## 시나리오 2. 대화 기반 신규 deck 생성

1. 홈에서 “새 deck 만들기” 클릭
2. 주제, 목적, 대상, 분량 입력
3. 필요 시 참고 파일 업로드 또는 텍스트 붙여넣기
4. LLM과 대화하며 outline 정리
5. 생성 실행
6. deck preview 확인
7. editor로 전환

## 시나리오 3. bbox 선택 편집

1. 특정 slide 열기
2. 요소 또는 영역 드래그 선택
3. “이 영역을 더 간결하게”, “색 대비 높여줘” 등 요청
4. LLM 수정 실행
5. 결과 반영
6. 필요 시 다시 수정 또는 롤백

## 시나리오 4. 덱 전체 수정

1. 사용자: “전체 톤을 투자자 pitch deck처럼 바꿔줘”
2. 시스템: 전체 deck에 대한 영향 범위와 예상 변경 내역 제시
3. 사용자 승인 후 일괄 수정
4. 수정 완료 후 before/after 비교 제공

## 시나리오 5. 롤백

1. 편집 후 결과가 마음에 들지 않음
2. History 패널 확인
3. 특정 revision 선택
4. slide 단위 또는 deck 전체 복구
5. 복구 결과 반영

## 시나리오 6. export

1. PDF export 클릭
2. export mode 선택
3. 생성 상태 확인
4. 다운로드
5. 필요 시 PPTX / Figma용 export도 실행

---

# 6. 제품 구조

## 6.1 주요 메뉴

1. **Home / Dashboard**
2. **New Deck**
3. **Deck Workspace**
4. **Editor**
5. **History / Rollback**
6. **Export Center**
7. **Settings**

## 6.2 기본 화면 구조

### Home / Dashboard

* 최근 deck 목록
* 새 deck 만들기
* 마지막 수정 시간
* export 상태
* 오류가 난 deck 표시

### New Deck

* 프로젝트명
* 목적
* audience
* 슬라이드 수
* 톤앤매너
* 참고 자료 입력
* 생성 시작

### Deck Workspace

* deck metadata
* slide list
* 전체 대화창
* “outline 수정”, “deck 재생성”, “전체 스타일 변경” 기능

### Editor

* 기존 slides preview
* bbox 선택
* 선택 영역 수정 프롬프트
* 현재 모델 선택
* 결과 로그
* undo / rollback 진입

### History / Rollback

* revision timeline
* 수정 주체: AI / 직접 편집 / export 전 snapshot
* diff 개요
* 특정 revision 복구

### Export Center

* PDF
* PNG
* PPTX
* Figma import용 PPTX
* export history

### Settings

* workspace 경로
* Claude Code 연결 상태
* 기본 모델
* theme preset
* 회사 브랜드 설정
* 안전 정책 옵션

---

# 7. 기능 요구사항

## 7.1 온보딩 및 설정

### FR-001. 로컬 웹 앱 접속

* 사용자는 브라우저에서 로컬 URL로 앱에 접속할 수 있어야 한다.

### FR-002. workspace 설정

* 사용자는 기본 deck 저장 경로를 지정할 수 있어야 한다.
* 지정하지 않으면 기본 경로를 생성한다.

### FR-003. provider 연결 상태 확인

* Claude Code 설치 여부를 확인해야 한다.
* 인증 상태 또는 실행 가능 상태를 확인해야 한다.
* 실패 시 원인과 해결 가이드를 보여줘야 한다.

### FR-004. 기본 모델 선택

* 사용자는 기본 실행 모델을 선택할 수 있어야 한다.
* 향후 다중 provider 확장이 가능해야 한다.

### FR-005. 테마 preset 설정

* 사용자는 default theme를 선택할 수 있어야 한다.
* 예: Corporate Minimal, Dark Tech, Editorial, Product Launch

---

## 7.2 신규 deck 생성

### FR-010. 새 deck 생성 폼

* 필수 입력값: deck name, topic
* 선택 입력값: objective, audience, desired number of slides, tone, supporting content

### FR-011. deck 생성 대화

* 시스템은 생성 전에 사용자와 brief를 정리할 수 있어야 한다.
* 필요한 경우 outline 수준에서 수정 반복이 가능해야 한다.

### FR-012. outline 생성

* 제목, 메시지 흐름, slide별 의도 포함
* 사용자가 승인 또는 수정 가능

### FR-013. slide HTML 생성

* outline 승인 후 slide HTML 파일들을 deck workspace에 생성
* 생성된 deck은 editor에서 즉시 열 수 있어야 함

### FR-014. 생성 결과 validation

* deck 생성 직후 자동 validate 실행
* 실패 항목은 UI에서 확인 가능

---

## 7.3 deck 편집

### FR-020. slide 목록 조회

* deck 내 slide 목록을 표시해야 한다.

### FR-021. slide preview

* 사용자는 각 slide를 즉시 미리볼 수 있어야 한다.

### FR-022. 직접 텍스트 편집

* 특정 텍스트 요소는 브라우저에서 직접 편집 가능해야 한다.

### FR-023. bbox 선택 편집

* 사용자는 수정할 화면 영역을 드래그 선택할 수 있어야 한다.
* 선택 영역 정보를 LLM에게 함께 전달해야 한다.

### FR-024. 선택 영역에 대한 LLM 수정

* 사용자가 프롬프트를 입력하고 수정 실행
* 선택 영역, slide 파일, 현재 slide context를 함께 사용

### FR-025. 전체 slide 수정

* 사용자는 slide 전체에 대한 수정 프롬프트를 보낼 수 있어야 한다.

### FR-026. deck 전체 수정

* 사용자는 deck 전반의 톤앤매너, 스토리 흐름, 페이지 구조를 수정하도록 요청할 수 있어야 한다.

### FR-027. 실행 로그 및 상태 표시

* 요청 대기 / 실행 중 / 성공 / 실패 / 취소 상태 표시
* 실시간 로그 표시

### FR-028. 중복 실행 방지

* 동일 slide에 대해 동시에 여러 AI 수정 요청이 겹치지 않도록 보호해야 한다.

---

## 7.4 History / Rollback

### FR-030. 자동 snapshot 생성

아래 시점마다 snapshot을 생성해야 한다.

* deck 생성 완료 직후
* LLM 수정 직전
* 직접 편집 저장 직전
* 일괄 수정 직전
* export 직전

### FR-031. revision metadata 저장

각 revision에는 다음이 포함돼야 한다.

* revision id
* timestamp
* 사용자 action type
* 수정 대상 slide 또는 deck 전체
* 사용 프롬프트
* 사용 모델
* 생성 파일 변경 목록

### FR-032. slide 단위 rollback

* 특정 slide만 이전 revision으로 복구 가능해야 한다.

### FR-033. deck 전체 rollback

* 전체 deck을 이전 revision으로 되돌릴 수 있어야 한다.

### FR-034. before/after diff

* 가능한 경우 파일 diff 또는 visual diff를 제공해야 한다.

---

## 7.5 Export

### FR-040. PDF export

* 기본 export로 제공
* 검색 가능 텍스트 중심 모드와 시각 충실도 중심 모드를 구분할 수 있어야 함

### FR-041. PNG export

* slide 이미지 내보내기 제공

### FR-042. PPTX export

* best-effort 성격으로 제공
* UI에 실험적 기능임을 표시

### FR-043. Figma import용 PPTX export

* best-effort 성격으로 제공
* UI에 실험적 기능임을 표시

### FR-044. export history

* 언제 어떤 포맷으로 내보냈는지 확인 가능해야 함

---

## 7.6 회사용 커스터마이징

### FR-050. 브랜드 테마 등록

* 회사 공통 컬러
* 폰트
* corner radius
* spacing rule
* chart style

### FR-051. 템플릿 등록

* intro deck
* product pitch deck
* investor deck
* research summary deck

### FR-052. 프롬프트 preset

* “깔끔한 컨설팅 스타일”
* “B2B 세일즈 톤”
* “대표 발표용 간결 톤”

### FR-053. 생성 정책 반영

* 일정한 페이지 수 제한
* 금지 스타일
* 필수 footer / logo 규칙

---

# 8. 비기능 요구사항

## 8.1 성능

* 20장 이하 deck은 편집기 로딩이 원활해야 한다.
* 한 slide 수정 요청은 UI가 멈추지 않아야 한다.
* export 상태는 비동기 진행상태로 보여야 한다.

## 8.2 안정성

* 실행 실패 시 사용자가 이전 상태를 잃지 않아야 한다.
* 오류가 발생한 run은 명확한 실패 로그를 남겨야 한다.

## 8.3 보안 및 안전성

* 수정 가능한 파일 경로는 workspace 내부로 제한해야 한다.
* LLM 실행 프로세스는 임의 디렉터리에 쓰지 못하도록 방어해야 한다.
* 인증 정보는 UI에 노출하지 않아야 한다.
* prompt, 실행 이력, export 로그는 로컬 우선 저장 정책을 따른다.

## 8.4 확장성

* Claude Code 이외의 provider를 추가할 수 있는 추상화 계층 필요
* 생성 파이프라인과 편집 파이프라인을 분리 설계

## 8.5 사용성

* 비개발자도 도움말 없이 기본 워크플로우를 수행할 수 있어야 한다.
* 빈 상태 화면, 실패 화면, 진행 중 상태가 명확해야 한다.

---

# 9. 핵심 시스템 설계 제안

## 9.1 서비스 구성

### 1. Web UI

* Dashboard
* New Deck Wizard
* Editor
* History
* Export Center
* Settings

### 2. Local App Server

* 프로젝트 관리 API
* provider 상태 API
* generation API
* editing bridge API
* rollback API
* export API

### 3. Slides Engine Layer

* 기존 `slides-grab` 기능 재사용
* edit / validate / export / viewer 기능 통합

### 4. LLM Orchestrator

* Claude Code 실행
* 향후 Codex, 기타 provider 대응
* prompt template 관리

### 5. Versioning Store

* 로컬 snapshot 저장소
* metadata 저장소
* diff 계산

---

# 10. 데이터 모델 초안

## 10.1 Project

* id
* name
* workspacePath
* createdAt
* updatedAt
* activeThemeId
* defaultModel

## 10.2 Deck

* id
* projectId
* title
* slideCount
* status
* createdAt
* updatedAt

## 10.3 Slide

* id
* deckId
* filePath
* order
* title(optional)
* updatedAt

## 10.4 Revision

* id
* deckId
* scope: `slide | deck`
* targetSlideId(optional)
* actionType: `generation | llm_edit | manual_edit | rollback | export_snapshot`
* prompt(optional)
* model(optional)
* snapshotPath
* createdAt

## 10.5 ExportJob

* id
* deckId
* format: `pdf | png | pptx | figma_pptx`
* status
* outputPath
* createdAt
* completedAt

## 10.6 ProviderStatus

* provider
* installed
* authenticated
* availableModels
* lastCheckedAt

---

# 11. MVP 범위

## MVP 포함

### M1. 앱 초기화

* 로컬 웹 접속
* workspace 지정
* provider 상태 확인
* 기본 모델 선택

### M2. 기존 deck 열기

* 기존 `slides-grab` deck을 웹에서 열기
* slide 목록 보기
* editor 연동

### M3. editor UX 통합

* bbox 선택 편집
* 직접 텍스트 수정
* 실행 로그 보기

### M4. 신규 deck 생성 v1

* form 기반 brief 입력
* Claude Code를 통해 outline + slide HTML 생성
* 생성 후 editor로 이동

### M5. rollback v1

* 자동 snapshot
* 가장 최근 변경 1-step undo
* revision 목록 조회

### M6. export

* PDF export
* PPTX/Figma export는 experimental로 노출

## MVP 제외

* 협업 기능
* 클라우드 로그인
* 세밀한 visual diff
* 템플릿 마켓플레이스
* 복잡한 관리자 콘솔

---

# 12. 단계별 개발 로드맵

## Phase 1. 현재 기능 웹 제품화

목표: CLI 없이 기존 기능을 브라우저에서 사용

* Local server shell 정리
* Dashboard 추가
* deck 탐색 UI
* settings UI
* provider health check
* 기존 editor 기능 연결

## Phase 2. 신규 deck 생성 플로우

목표: 대화로 deck 시작 가능

* deck 생성 wizard
* brief → outline
* outline 수정 루프
* HTML slide 생성
* validate 자동 실행

## Phase 3. History와 롤백

목표: AI 수정의 불안정성을 줄임

* snapshot 생성
* revision metadata 저장
* 최근 수정 undo
* revision restore

## Phase 4. 회사 커스터마이징

목표: 사내 표준 스타일 적용

* theme preset
* company design tokens
* prompt preset
* deck templates

## Phase 5. 완성도 개선

목표: 제품성 강화

* visual diff
* export UX 개선
* 오류 복구 경험 개선
* 사용성 polish

---

# 13. 성공 지표

## 13.1 사용성 지표

* 신규 사용자가 설치 이후 10분 내 첫 deck 생성 가능
* 터미널 미사용 상태로 deck 열기 → 수정 → PDF export 완료 가능

## 13.2 생산성 지표

* 단순 보고용 deck 제작 소요 시간 감소
* 수작업 수정 대비 반복 요청 횟수 감소

## 13.3 품질 지표

* 수정 실패 후 손실 없이 복구 가능
* export 실패율 감소

## 13.4 사내 도입 지표

* 월간 활성 사용자 수
* 생성 deck 수
* export 수
* rollback 사용률

---

# 14. 주요 리스크와 대응

## 리스크 1. LLM 편집 결과가 예측 불가능

**대응**

* 자동 snapshot
* 변경 diff
* revision restore

## 리스크 2. Claude Code 실행 환경 편차

**대응**

* provider health check
* 설치/인증 가이드 UI
* 명확한 실패 메시지

## 리스크 3. CLI 기능과 웹 기능 간 불일치

**대응**

* core 기능은 기존 `slides-grab` 로직 최대한 재사용
* 웹은 orchestration layer로 한정

## 리스크 4. 보안 문제

**대응**

* workspace path confinement
* 위험한 파일 수정 차단
* action logging

## 리스크 5. PPTX/Figma export 품질 변동

**대응**

* experimental 배지
* PDF를 기본 export로 전면 배치

---

# 15. Claude Code 구현을 위한 권장 Epic 구조

## Epic 1. App Shell & Workspace

* 프로젝트 bootstrap
* 기본 route
* deck list
* settings persistence

## Epic 2. Provider Status

* Claude Code 감지
* auth 상태 감지
* UI indicator
* 실패 처리

## Epic 3. Deck Generation

* create deck API
* prompt template
* outline generation
* HTML slide generation

## Epic 4. Editor Integration

* 기존 slides editor 연결
* run status 표시
* slide refresh

## Epic 5. Revision System

* snapshot storage
* revision DB
* restore logic
* undo UI

## Epic 6. Export Flow

* PDF export integration
* export state UI
* job log

## Epic 7. Custom Theme System

* theme schema
* default theme
* custom preset registration

---

# 16. 기능 우선순위

## P0 — 반드시 필요

* 로컬 웹 접속
* workspace 설정
* 기존 deck 열기
* Claude Code 연결 상태 확인
* bbox edit 유지
* 신규 deck 생성 v1
* PDF export
* rollback v1

## P1 — 매우 중요

* deck history 상세화
* theme preset
* slide 단위 restore
* deck 전체 수정 대화

## P2 — 있으면 좋음

* visual diff
* Figma export UX 개선
* deck template gallery

---

# 17. 오픈 이슈

1. deck 생성은 Claude Code skill 기반으로 orchestrate할지, 앱 자체 prompt pipeline으로 재구현할지?
2. revision 저장소는 파일 snapshot 방식으로 갈지, Git-like 방식으로 갈지?
3. provider 연결 상태를 어느 수준까지 자동 판별할지?
4. 회사 테마를 CSS token 기반으로 둘지, prompt rule 기반으로 둘지?
5. 기존 editor를 iframe/내장형으로 재사용할지, 완전히 새 UI로 이전할지?

---

# 18. 권장 기술 결정 초안

## 권장안

### 1. 구현 방향

* **1차**: 기존 `slides-grab` editor/backend 재사용
* **2차**: 제품 shell만 별도 구축

### 2. 신규 deck 생성

* Claude Code orchestration 기반으로 먼저 구현
* 필요 시 이후 app-native pipeline으로 이동

### 3. versioning

* MVP에서는 파일 snapshot 방식
* 차후 diff와 브랜치 개념 필요 시 Git-like 구조 도입

### 4. export

* PDF를 기본값
* PPTX/Figma는 보조 기능

---

# 19. 예시 사용자 플로우

## Flow A. 신규 deck 생성

1. 새 deck 만들기 클릭
2. 주제 입력
3. 대상/목적 입력
4. outline 생성
5. outline 수정
6. deck 생성
7. editor 진입
8. bbox 수정
9. PDF export

## Flow B. 기존 deck 수정

1. dashboard에서 deck 클릭
2. slide 4 선택
3. 우측 상단 박스 드래그
4. “문구를 더 직관적으로” 입력
5. 수정 반영
6. 마음에 안 들면 롤백

---

# 20. Acceptance Criteria

## AC-001. 초기 설정

* 사용자가 workspace를 지정하면 값이 저장된다.
* 앱 재접속 시 마지막 설정이 유지된다.

## AC-002. provider status

* Claude Code 사용 가능 여부가 UI에 표시된다.
* 사용 불가 시 사용자가 다음 행동을 이해할 수 있다.

## AC-003. 신규 deck 생성

* 필수 입력만으로 deck 생성이 가능하다.
* 생성 후 editor에서 deck이 열린다.

## AC-004. bbox edit

* 사용자가 선택한 영역과 프롬프트를 바탕으로 수정 요청을 보낼 수 있다.
* 성공/실패 상태가 UI에 표시된다.

## AC-005. rollback

* 직전 AI 수정 이전 상태로 되돌릴 수 있다.

## AC-006. export

* PDF 파일 export가 가능하다.
* export 성공/실패가 화면에 표시된다.

---

# 21. 이후 상세화가 필요한 문서

본 PRD 이후 아래 문서를 추가 작성한다.

1. **Technical Design Document**
2. **Information Architecture / 화면 설계서**
3. **API Spec**
4. **DB Schema / File Storage Spec**
5. **Claude Code 작업 지시서**
6. **MVP 구현 체크리스트**

---

# 22. 최종 제안

이 제품은 단순한 CLI 래퍼가 아니라, `slides-grab`을 기반으로 한 **AI-first 슬라이드 제작 스튜디오**다.

첫 버전의 핵심은 다음 네 가지에 집중한다.

1. 터미널 제거
2. 생성부터 편집까지 웹에서 일원화
3. 롤백 보장
4. 회사 스타일 커스터마이징 기반 마련

이 네 가지가 성립하면, 사내 도입 가치는 충분하다.
