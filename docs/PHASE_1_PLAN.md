# Phase 1 작업 계획 — 4 화면 동작하는 MVP

> 목표: `docs/mockups/`의 4 화면을 정적 mockup 그대로 동작하게 만든다.
> 산출물: 사용자가 `pnpm dev` 한 줄로 띄워서 4 화면을 클릭으로 통과시키고 실제 슬라이드를 받을 수 있는 로컬 웹 앱.

---

## 0. Phase 1 완료 조건 (Acceptance)

다음이 모두 동작하면 Phase 1 완료.

1. 사용자가 `pnpm dev` 실행 후 `http://localhost:3000` 접속하면 화면 1로 진입한다.
2. **화면 1** — Claude Code 또는 Codex 설치 여부를 실제로 감지해서 표시한다. 둘 다 미설치면 화면 2 진입이 막힌다.
3. **화면 2** — 제목 + 텍스트(또는 파일) 입력으로 다음 화면 진입 가능. 입력값은 임시 저장된다.
4. **화면 3** — slides-grab이 제공하는 템플릿 목록을 실제로 받아 HTML 견본 카드로 렌더한다. 하나 선택하면 다음으로 진행 가능.
5. **화면 4** — slides-grab CLI 호출로 deck이 생성되고, 슬라이드 썸네일 + 큰 미리보기가 실제로 보인다. 수정 모드 토글 시 slides-grab의 web 편집 기능에 연결된다.
6. 모든 사용자 UI 텍스트는 비개발자용 쉬운 한국어. 영문 기술 용어 노출 없음.
7. 4 화면 사이 이동이 mockup과 동일하게 작동한다.

---

## 1. Task 단위 (T1 ~ T9)

### T1. 프로젝트 스캐폴드 {#t1}

- Next.js (App Router, TS) + pnpm + Tailwind 셋업
- ESLint + Prettier 기본 설정
- `tailwind.config.ts` 에 mockup의 색/반경/그림자 토큰 이식
- 루트 라우트 `/` 로 화면 1 진입
- 4 화면 라우트 자리만 만들어둠 (`/`, `/upload`, `/templates`, `/deck/[id]`)
- 의존성: 없음
- **완료 조건**: `pnpm dev` 후 `/` 가 mockup 1 화면과 시각적으로 매칭됨 (로직 없이 정적)

### T2. slides-grab 통합 결정 + 셋업 {#t2}

- slides-grab 레포 구조 / 배포 형태 확인 (npm 패키지인지, 실행 가능한 CLI 만 있는지, 어떤 형태인지)
- 미해결 결정 **D-01** 처리: submodule / fork / npm dep 중 하나로 확정
- `vendor/slides-grab/` 또는 `package.json` deps 에 등록
- `lib/slides-grab/cli.ts` 어댑터 골격 작성 (현 시점에서는 호출만, 실제 동작은 다음 task)
- 의존성: T1
- **완료 조건**: `lib/slides-grab/cli.ts` 에서 `--version` 같은 무해한 명령이 stdout 으로 돌아옴

### T3. AI provider 추상화 + 화면 1 동작 {#t3}

- `lib/providers/` 에 `provider.ts` 인터페이스 정의 (`detect()`, `auth()`, `run(prompt, opts)`)
- `lib/providers/claude-code.ts`, `lib/providers/codex.ts` 구현 — 실제로 `claude --version`, `codex --version` 같은 subprocess 호출 후 결과 파싱
- API 라우트 `app/api/providers/route.ts` — 두 provider 의 detect 결과 JSON 반환
- 화면 1 클라이언트에서 위 API 호출하여 카드 상태 실제 표시
- 미해결 결정 **D-03** 처리
- 의존성: T1
- **완료 조건**: 실제로 Claude Code 가 깔린 환경 / 안 깔린 환경에서 화면 1 표시가 다르게 나옴

### T4. SQLite 초기화 + 최소 스키마 {#t4}

- `better-sqlite3` 설치
- `lib/db/index.ts` — `data/app.db` 자동 생성, 마이그레이션 시스템 (간단)
- 최소 스키마: `projects`, `decks`, `slides`, `provider_status_cache`
- `lib/db/queries/` 에 read/write 함수
- 의존성: T1
- **완료 조건**: 앱 첫 실행 시 `data/app.db` 가 만들어지고 빈 테이블 4개 존재

### T5. 화면 2 (내용 올리기) 동작 {#t5}

- 입력 폼 컴포넌트 — 제목 + 탭 (텍스트 / 파일)
- 파일 업로드 처리: `data/uploads/<sessionId>/` 에 저장
- `POST /api/uploads` — multipart 처리
- 다음 단계로 넘기는 시점에 임시 deck 행을 `decks` 테이블에 status=`draft` 로 insert, 입력 컨텐츠를 연결
- 미해결 결정 **D-04** 처리
- 의존성: T1, T4
- **완료 조건**: 화면 2 에서 제목 + 텍스트 입력 후 "다음" 누르면 임시 deck 이 만들어지고 화면 3 으로 넘어감

### T6. 화면 3 (디자인 고르기) — slides-grab 템플릿 동적 렌더 {#t6}

- `lib/slides-grab/cli.ts` 에 `listTemplates()` 추가 — slides-grab CLI 의 템플릿 목록 명령 호출 + 파싱
- `GET /api/templates` — 결과 JSON 반환 (각 항목: id, name, description, previewHtml 또는 previewPath)
- 화면 3 클라이언트: API 결과를 카드 그리드로 렌더링. 각 카드 안에 실제 HTML 견본을 `iframe srcdoc` 또는 inline 렌더링.
- 카드 ⛶ 클릭 시 모달에서 더 큰 미리보기.
- 선택한 템플릿 id 를 deck 행에 저장.
- 의존성: T2, T5
- **완료 조건**: 화면 3 에 slides-grab 이 실제로 가진 템플릿 카드가 노출됨. 하드코딩 없음.

### T7. 화면 4 (슬라이드 보기) — 생성 + 부분 렌더 {#t7}

- `POST /api/decks/[id]/generate` — slides-grab CLI 의 생성 명령을 백그라운드로 실행. 생성 job 정보를 SQLite 에 저장.
- `GET /api/decks/[id]/status` — 진행률 + 완성된 슬라이드 목록 반환
- 화면 4 클라이언트: status API 폴링 (또는 파일 watch / SSE) — 생성된 슬라이드부터 썸네일 + 미리보기에 차례로 노출
- 큰 미리보기는 `<iframe src="/api/decks/[id]/slides/<n>" />` 로 slides-grab 산출 HTML 그대로 렌더
- 미해결 결정 **D-02** 처리
- 의존성: T2, T4, T6
- **완료 조건**: 화면 4 에서 진행률 막대 + 완성된 슬라이드 1~N 까지 실시간 노출. 모든 슬라이드가 완성되면 상태 표시가 "완료" 로 바뀜.

### T8. 화면 4 — 수정 모드 (slides-grab 웹 에디터 연결) {#t8}

- slides-grab 의 web edit / build-viewer 산출물을 어떻게 임베드하는지 조사 (T2 결정에 따라 달라짐)
- "수정하기" 토글 시 미리보기 iframe 을 편집 가능 viewer 로 교체
- 별도 편집 UI 재구현은 금지 (CLAUDE.md 규칙)
- 의존성: T2, T7
- **완료 조건**: 사용자가 수정 모드로 들어가 슬라이드 한 요소를 고치고 결과가 다시 보임. 변경은 디스크에 반영.

### T9. 에러 / 빈 상태 / 로딩 폴리쉬 + README {#t9}

- AI 미연결 상태 화면 / API 실패 토스트 / slides-grab 호출 실패 처리
- 빈 상태 (업로드 안 됨, 템플릿 0개 등) 안내 문구
- `README.md` — 1줄 실행법, 시스템 요구사항 (macOS, Node 버전, slides-grab 사전 설치 여부 등)
- 의존성: T3 ~ T8
- **완료 조건**: 각 화면에서 실패 / 빈 케이스가 mockup 의 사용자 친화 톤으로 표시. README 만 보고 새 사람이 띄울 수 있음.

---

## 2. 의존성 그래프

```
T1 ─┬─> T2 ─┬─> T6 ─> T7 ─> T8 ─> T9
    │       └────────────────────^
    ├─> T3 ─────────────────────^
    └─> T4 ─> T5 ─> T6
```

## 3. 1차 범위 밖 (이 Phase 에서 절대 안 함)

- 되돌리기 / 수정 기록 / snapshot
- 내보내기 (PDF / PNG / PPTX / Figma)
- 발표 자료 삭제 / 복제 / 휴지통
- 회사 테마 / 브랜드 / 정책 설정
- outline 수정 단계 (현재 흐름은 입력 → 바로 생성)
- 사용자 계정 / 권한 / 멀티 유저
- 모바일 레이아웃

PRD 에는 있지만 위 항목들은 Phase 1 산출물에 등장하지 않는다.

## 4. 코드 시작 시 첫 명령

다음 세션 시작 시:

```bash
# 현재 위치 확인
cat docs/STATUS.md

# T1 시작
pnpm create next-app@latest . --typescript --tailwind --app --src-dir false --import-alias "@/*"
```

작업 단위로 PR 또는 commit 분리. 각 task 완료 시 `docs/STATUS.md` 의 변경 로그 갱신.
