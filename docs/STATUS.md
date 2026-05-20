# STATUS — 현재 진행 상태

> 매 세션 종료 시 이 문서를 갱신한다. 다음 세션은 이 파일만 봐도 즉시 복귀 가능해야 한다.

---

## 0. 프로젝트 본질 (잊지 말 것)

**이 앱은 CLI 로 Claude Code 와 하는 slides-grab 작업을 그대로 웹 UI 로 옮긴 wrapper 다.**

사용자가 평소 하는 일:
```
$ claude
> 이 .md 파일 첨부했어. slides-grab 으로 발표 자료 만들어줘.
```
→ AI 가 plan / design / validate skill 호출해서 잘 만듦.

**우리 앱이 추가하는 가치:**
1. 비개발자용 UI (4 화면 + 라이브러리)
2. 파일 관리 (`data/decks/<id>/{uploads,output}/`)
3. 진행률 시각화 (status 폴링 + 단계 라벨)
4. 라이브러리 (만든 deck 들 다시 보기)
5. 슬라이드 미리보기 (1280px 콘텐츠를 stage 사이즈로 scale)
6. **inline 텍스트 편집 patch** (slides-grab editor 의 `innerHTML` 평탄화 한계를 `contentEditable` 로 우회)

**AI 작업 자체는 손대지 않는다.** 사이즈 / 태그 / 폰트 / 분량 / wrapping 등은 모두 slides-grab skill 책임. 우리 prompt 에 중복 명시 X.

우리가 prompt 에 추가해야 하는 정보는 딱 4가지:
1. 입력 파일 위치 (`uploads/_brief.md` + 첨부)
2. 출력 위치 (`output/slide-NN.html`)
3. non-interactive 환경 안내 (자동 승인으로 끝까지)
4. 디자인 스타일 id (있을 때만)

+ 우리 앱 hard requirement 하나: 수정 도구 호환 위해 `<div>` 안 직접 텍스트 X. (skill 룰이지만 우리는 강제)

---

## 1. 지금 어디 있나

**Phase 1 사양 완전 만족. 데모 가능 상태.**

`/` → `/start` → `/upload` → `/templates` → `/deck/[id]` 전체 흐름이 실제 AI 호출로 동작. 라이브러리에서 만든 deck 다시 볼 수 있음. 수정 도구는 인라인 편집으로 inline 자식 (색깔 등) 보존.

남은 건 선택적 robustness 작업뿐.

---

## 2. 남은 작업

### **다음 세션 1순위 — 내보내기 (export) 기능**

사용자 요구: "결과물 추출이 없어. PDF든 PPT든 뭐든." 만든 deck 을 사용자가 PC 에 받아갈 길이 없는 게 가장 큰 한계.

**좋은 소식**: slides-grab CLI 가 이미 다 지원. 우리가 추가할 건 UI + subprocess 호출 + 다운로드 링크뿐.

slides-grab CLI 실제 옵션 (확인됨, `pnpm exec slides-grab pdf --help` 등):

```bash
slides-grab pdf  --slides-dir output --output <name>.pdf [--mode capture|print] [--resolution 2160p]
slides-grab png  --slides-dir output --output-dir <dir>  [--resolution 2160p]   # 슬라이드 1장 = PNG 1장
slides-grab convert --slides-dir output --output <name>.pptx                    # experimental / unstable
slides-grab figma   --slides-dir output --output <name>-figma.pptx              # Figma Slides 수동 import 용, experimental
```

`pdf` / `png` 안정, `convert` (pptx) / `figma` 베타. **세부 옵션 (해상도, mode) 사용자 노출 X** — 디폴트 (`capture` / `2160p`) 만 사용 (비개발자 UX 결정 피로 0).

**작업 단위 (이 순서대로)**:

1. **mockup**: `docs/mockups/07-export.html` — toolbar 의 `⬇ 내보내기` 버튼 + 모달. 옵션 4개: PDF (권장) / PNG zip / PPTX (베타) / Figma Slides 용 (베타). 진행 중 스피너 + 완료 시 다운로드 버튼. (룰 1 — mockup 먼저 합의받기) ✅ 작성됨 (2026-05-18)
2. **API**: ✅ 작성됨 (2026-05-18)
   - `POST /api/decks/[id]/export` body `{ format: "pdf" | "png" | "pptx" | "figma" }` → export job 시작, `{ jobId }` 반환
   - `GET /api/decks/[id]/export/[jobId]` → `{ status: "running"|"done"|"failed", format, filename, sizeBytes, error, downloadUrl }`
   - `GET /api/decks/[id]/export/[jobId]/file` → 파일 stream (Content-Disposition: attachment; filename* UTF-8)
3. **subprocess 어댑터** `lib/decks/export.ts` ✅ 작성됨 (2026-05-18). cwd = `data/decks/<id>/`. 형식별 명령:
   - pdf: `slides-grab pdf --slides-dir output --output exports/<jobId>.pdf`
   - png: `slides-grab png --slides-dir output --output-dir exports/<jobId>-png/` → 끝나면 시스템 `zip -j -r exports/<jobId>.zip <pngDir>` 으로 묶음 (zip 안 파일은 flat)
   - pptx: `slides-grab convert --slides-dir output --output exports/<jobId>.pptx`
   - figma: `slides-grab figma --slides-dir output --output exports/<jobId>.pptx` (디스크는 같은 ext, 사용자 표시 파일명만 `-figma.pptx`)
   진행 중 상태는 in-memory `Map<jobId, ExportJob>` + `Map<deckId, jobId>` (한 deck 동시 1 job). 서버 재시작 시 디스크에서 done 복원. PDF/PPTX 같은 deck 의 bulk-edit 와도 상호 배제 (`isExporting` / `isBulkEditing` 양방향 체크).
   smoke test 통과 (FDE deck 20장 → PDF 32초, 56MB, magic bytes %PDF-1.7).
4. **UI 연결** — deck 페이지 toolbar 에 버튼, 모달, polling. ✅ 작성됨 (2026-05-18)
5. **라이브러리 카드 빠른 다운로드** ✅ 작성됨 (2026-05-18) — `components/QuickExport.tsx`. 카드 우하단 ⬇ → 형식 메뉴 (PDF 권장 / 이미지 묶음 잠금 / PPTX 베타 / Figma 베타) → preview 위 overlay 로 진행/완료/실패 → 완료 시 자동 다운로드 trigger + "다시 받기" 옵션. mockup `docs/mockups/08-library-export.html`. 한계: 페이지 새로고침 시 진행 중인 job 의 UI 가 idle 부터 다시 시작 (server-side 진행은 계속). 카드 mount 시 server 의 in-progress job 복원은 후속.

**디스크 위치**: `data/decks/<id>/exports/<jobId>.{pdf,zip,pptx}` / `<jobId>-figma.pptx`. 다음 export 시 같은 포맷이면 덮어쓰기 vs 새 jobId? — 새 jobId 권장 (실패 보존).

**룰 (CLAUDE.md 6)**: export prompt 같은 거 없음. CLI 직접 호출이라 AI 가 개입 안 함. skill 의 export 룰은 slides-grab 자체가 안다.

### 그 외 (낮음)

| 우선순위 | 항목 | 비고 |
|---|---|---|
| ~~낮음~~ ✅ | ~~Codex provider e2e 검증~~ | 2026-05-18 완료 — 6장 deck 5분, slides-grab skill 자동 설치 + provider-aware prompt + `--skip-git-repo-check` 까지 |
| ~~낮음~~ ✅ | ~~dev server crash robustness~~ | 2026-05-20 완료 — `getDb()` 부팅 시 `status IN ('generating','outlining')` deck 들을 `failed` 로 자동 정리. 사용자가 다시 시도 가능 |
| 결정 보류 | **card-news 워크플로우** | slides-grab 은 `--mode card-news` 로 720pt × 720pt 정사각형 인스타 카드도 만든다 (별도 `slides-grab-card-news` skill). 우리 앱은 현재 발표 (presentation) 만 지원. 카드 뉴스도 만들려면 화면 2 에 "발표 자료 / 카드 뉴스" 선택 + AI prompt 에 `--mode card-news` + viewer 1:1 비율 + export 도 자동 정사각형 적용 필요. 2026-05-18 사용자 결정: **이번 export 작업 범위 밖**, 추후 결정. |
| Phase 2 | 삭제 / 복제 / 휴지통 / 되돌리기 | 1차 범위 밖 |
| Phase 2 | 회사 테마 / 멀티 유저 / 모바일 | 1차 범위 밖 |
| 후속 | slides-grab upstream PR | 우리 contentEditable patch 를 본가에 기여 → 다음 버전부터 patch 불필요 |
| 후속 | **slides-grab PNG packaging 누락** | 1.2.6 / 1.3.0 둘 다 `bin/ppt-agent.js` 가 `scripts/html2png.js` 호출하나 `package.json#files` 에서 빠져 있음 → 우리 export 의 PNG 옵션 일시 비활성 (`DISABLED_FORMATS = ["png"]` in `lib/decks/export.ts` + ExportModal `pill: "soon"`). upstream 에 issue/PR 올리거나 patch 로 `html2png.js` 추가 후 Set 한 줄로 다시 활성. |

> "그 다음 작업 진행해" 한 줄이면 위 1순위 (export) 부터 시작합니다.

---

## 3. 미해결 결정

전부 처리됨.

| ID | 항목 | 확정 |
|---|---|---|
| D-01 | slides-grab 통합 방식 | npm dep (`slides-grab@1.2.6`) |
| D-02 | 진행 추적 방식 | API 폴링 (1s) + `visibilitychange` 시 즉시 refetch |
| D-03 | provider 감지 깊이 | 단순 `--version` 체크. 로그인 상태 표시 제거 |
| D-04 | 디스크 레이아웃 | `data/decks/<id>/{uploads,output}/`. 정리 시점은 1차 범위 밖 |

---

## 4. 알려진 한계 / 메모

- **macOS 외 미검증.** Linux 도 동작 가능성 높지만 Windows 는 process group kill 등 호환 X. 화면 1 푸터에 "현재 macOS 만 검증" 안내.
- **AI 호출 시간** — 한 deck 수 분 ~ 10분 이상. 사용자 Claude 토큰 사용.
- **dev server crash 시** — DB 의 `generating`/`outlining` 박제는 2026-05-20 부팅 cleanup 으로 자동 `failed` 정리. 진행 중이던 AI subprocess 는 부모와 함께 죽음 (zombie 없음).
- **수정 도구** — 부분 강조 헤딩의 텍스트 수정은 우리 contentEditable patch 로 작동. 다만 slides-grab editor 의 *사이드바 popoverTextInput* 으로 수정하면 여전히 `innerHTML` 평탄화 → 사용자가 슬라이드 안에서 직접 클릭해서 수정하는 게 정도.
- **업로드 한도** — 파일당 50MB / 한 요청 합산 200MB. 확장자 `.md/.txt/.pdf/.docx/.pptx` 만 허용. 서버·클라이언트 양쪽 검증.
- **deck 삭제** — UI 없음 (Phase 1 범위 밖). 라이브러리 하단에 `data/decks/<id>` 폴더 삭제 안내.
- **outline 되돌리기** — 사용자가 outline 수정 후 design 실패해도 `slide-outline.md.bak` 에서 직접 복구 가능. UI 는 없음.
- mockup 대비 변경: 화면 1 카드에서 "로그인됨 · {email}" 라인 제거 (D-03).

---

## 5. 변경 로그 (마일스톤만)

- 2026-05-16: 프로젝트 시작, PRD, mockup 4 화면, 워크플로우 합의
- 2026-05-17: T1~T8 + T7-real (실제 AI 호출) + 라이브러리 홈
- 2026-05-17: ScaledSlideFrame (1280px 콘텐츠 → wrap 사이즈로 transform scale)
- 2026-05-17: 화면 4 풀폭 / 헤더 고정 / 좌측 자체 스크롤 / 우측 16:9 fit
- 2026-05-17: slides-grab editor patch (`patches/slides-grab@1.2.6.patch`)
  - `getSelectableTargetAt` — inline 안 클릭 시 부모(h1/p/li) 까지 올라감
  - `setSelectedObjectXPath` — selection 시 `contentEditable=true` + focus. 다른 element 선택 시 `scheduleDirectSave` 로 디스크 저장. inline 자식 구조 보존.
- 2026-05-17: AI 생성 단계 라벨 (planning / designing / finalizing / ready / failed)
- 2026-05-17: polling 1s + `visibilitychange` 시 즉시 refetch
- 2026-05-18: prompt 단순화 — skill 책임 룰 (사이즈/태그/폰트/wrapping) 우리 prompt 에서 빼고 skill 에 위임. 우리는 (1) 입력/출력 위치 (2) non-interactive 자동 승인 (3) 스타일 id (4) 수정 도구 호환 hard requirement 4가지만 명시.
- 2026-05-18: plannedSlideTotal 동적화 — `slide-outline.md` 의 Slide Count 우선
- 2026-05-18: status API auto-flip — completedCount >= plannedTotal 면 자동 ready
- 2026-05-18: 일괄 수정 기능 — deck 페이지 toolbar 에 `✨ 전체 수정` 버튼 + 모달. 자연어 한 줄로 deck 전체 슬라이드 일괄 수정. `lib/decks/bulk-edit.ts` (generator 패턴 재사용), `POST /api/decks/[id]/bulk-edit`, MakingBar 의 "전체 슬라이드 수정 중…" 라벨, 완료 시 자동 cache-bust. mockup: `docs/mockups/06-bulk-edit.html`.
- 2026-05-18: 일괄 수정 robustness — `lib/decks/bulk-edit.ts` 에 mtime snapshot before/after 비교. AI 가 nonzero exit 으로 끝나도 슬라이드 파일이 실제로 수정됐으면 ready 처리. 일괄 수정 prompt 에 사용자가 명시적으로 요청 시 slide 추가/삭제 허용 (삭제는 idx gap 안 생기게 rename).
- 2026-05-18: `plannedSlideTotal` 신호 max 화 — 디스크의 실제 `slide-NN.html` max idx 가 outline.md 의 원래 계획보다 클 때 디스크 우선. bulk-edit 으로 슬라이드 추가된 경우 UI 가 모두 표시됨. (이전: outline 우선이라 14장만 보임 → 디스크 20장 다 표시)
- 2026-05-18: 내보내기 mockup `docs/mockups/07-export.html` — 4 옵션 (PDF / PNG / PPTX / Figma Slides), 진행/완료/실패 3 상태, 동작 메모. card-news 모드는 결정 보류 (별도 워크플로우라 1차 export 범위 밖).
- 2026-05-18: 내보내기 API + subprocess 어댑터 — `lib/decks/export.ts` (slides-grab CLI 직접 호출, AI 무관), 3 라우트 (`POST /api/decks/[id]/export`, `GET .../[jobId]`, `GET .../[jobId]/file`). in-memory job 추적, 디스크 fallback (서버 재시작 후 done 복원), 한 deck 동시 1 job, bulk-edit 와 상호 배제. PDF smoke test 통과.
- 2026-05-18: 내보내기 UI 연결 — `components/ExportModal.tsx` (4 phase: select / starting / running / done / failed), deck 페이지 toolbar 에 `⬇ 내보내기` 버튼 (✨ 전체 수정 옆, ✎ 수정하기 왼쪽). 모달이 unmount 돼도 parent state 의 polling 으로 백그라운드 진행 유지. 4 형식 e2e 검증: PDF ✅, PPTX ✅, Figma ❌ (FDE deck 의 CSS gradient 미지원 — 베타 한계), PNG ❌ (slides-grab 1.2.6/1.3.0 packaging 누락 → 일시 비활성 `DISABLED_FORMATS = ["png"]` + 모달에 "준비 중" 라벨).
- 2026-05-18: 라이브러리 카드 빠른 다운로드 — `components/QuickExport.tsx`. 홈의 deck 카드 우하단 ⬇ → 형식 메뉴 popover → preview 위 overlay 진행/완료/실패 → 완료 시 `<a download>` 프로그램 클릭 으로 자동 다운로드. 페이지 이동 없음. `app/page.tsx` 의 `DeckCard` 를 wrapper div + Link contents 로 재구성 (Link 안 button = invalid HTML 회피). mockup `docs/mockups/08-library-export.html`.
- 2026-05-18: slides-grab skill 자동 설치 — 화면 1 의 Claude Code 카드에 "slides-grab 기술" row 추가. `~/.claude/skills/slides-grab-{plan,design}/` 존재 여부 점검. missing/failed 시 "⚡ 자동 설치" 버튼 → 우리 앱이 `claude -p "Read https://.../installation/claude.md and follow every step." --dangerously-skip-permissions` spawn. 설치 중에는 1초 폴링 + spinner. skill 까지 OK 일 때만 "이걸로 사용" 버튼 활성 (= 다음 단계 진입 가능). `lib/providers/skills.ts` + `POST /api/providers/skills/install`. mv 시뮬레이션으로 점검 동작 검증 (missing ↔ installed flip 확인). 실제 설치 spawn 은 사용자 직접 테스트 (Claude 토큰 사용).
- 2026-05-18: outline 검토 단계 (화면 3.5) 추가 — slides-grab 본래 워크플로우의 plan→사용자 OK 단계를 비개발자 UI 로. 흐름: `draft → outlining → outline-ready → generating → ready`. `lib/decks/generator.ts` 가 2단계 분리 (`startPlanning` plan only, `startDesign` design+validate). 새 API: `GET/PUT /api/decks/[id]/outline` (raw markdown), `POST /api/decks/[id]/start` (design 시작). 새 페이지 `app/outline/[id]/page.tsx` — outline 1초 폴링 + 좌측 메타 + 우측 raw markdown textarea (직접 편집) + [이대로 만들기] / [디자인 다시]. `/templates` "시작하기" → `/outline/[id]` 로. `/deck/[id]` 가 draft/outlining/outline-ready 만나면 `/outline/[id]` 로 redirect. `/api/decks/[id]/generate` 의 `startGeneration` → `startPlanning` 으로 (옛 deck 호환은 startGeneration 함수 유지). mockup `docs/mockups/09-outline-review.html`.
- 2026-05-18: Codex provider e2e 검증 + 자동 설치 적용 — Codex 가 slides-grab skill 5개 인식 (`~/.agents/skills/` 위치, codex 가 자동 load). 우리 generator 의 codex spawn 으로 deck e2e 성공 (6장, 약 5분, status=ready). 발견된 두 가지 prompt 버그 fix: (a) `"Claude Code 에 설치돼 있어요"` 와 `"non-interactive 'claude -p' 호출"` 이 provider 무관 하드코딩 → `deck.provider_id` 따라 (`Claude Code` / `Codex`) + (`claude -p` / `codex exec`) 로 분기. generator.ts 와 bulk-edit.ts 둘 다. (b) codex 호출에 `--skip-git-repo-check` 추가 — deck dir 이 git repo 아니라 다른 PC 에선 trusted-dir 에러 가능성. `lib/providers/skills.ts` 가 두 provider 지원 — codex 점검은 `~/.agents/skills/`, 자동 설치는 `npx skills add ./node_modules/slides-grab -g -a codex --yes --copy` (Claude 의 `claude -p "Read ..."` 와 별개 명령). 화면 1 의 codex 카드도 같은 skill row + 자동 설치 버튼. POST body 에 `provider` 받음. 시뮬레이션: codex skill mv → API missing → POST → 2초만에 installed.
- 2026-05-18: 1차 패키징 (배포 준비) — 비개발자 대상. README 한국어 완전 재작성 ((Ⅲ) 완전 초보 친화: Node.js/pnpm/Claude Code 설치 step-by-step, FAQ, 알려진 한계). `start.command` macOS 더블클릭 런처 (cd + 첫 실행이면 자동 bootstrap + pnpm dev + 3초 뒤 브라우저 자동 open). `samples/` 폴더에 예시 brief 2개. **clean test 환경 검증 두 번**:
  - 1차 시도: `scripts.setup` 이름이 pnpm built-in `pnpm setup` (shell 환경 초기화) 과 충돌 → `pnpm install` 안 호출됨 → `next` 모듈 못 찾아서 dev 실패. `scripts.setup` → `scripts.bootstrap` 으로 rename + start.command 가 명령 직접 호출 (`pnpm install && pnpm exec playwright install chromium`) 으로 변경.
  - 2차 시도: `pnpm exec playwright` 가 transitive dep 못 찾아서 실패 (`Command "playwright" not found`). `playwright` 를 우리 직접 devDependency 로 추가 (`pnpm add -D playwright`). 이제 clean 환경 (~/Desktop/test-clean) 에서 `bash start.command` → install 2.7s (cached) → `🚀 서버 시작!` → `Ready in 230ms` → `/`, `/start`, `/api/providers` 모두 HTTP 200 정상.
- 2026-05-20: 비개발자 셋업 friction 축소 (A → B 순).
  - **A. provider 본체 ⚡ 자동 설치** — `lib/providers/install-body.ts` (Claude Code / Codex 본체 `npm install -g` spawn), API `app/api/providers/install/route.ts`, ProviderStatus 에 `bodyInstall` 필드, 화면 1 의 "설치 안 됨" 분기에 ⚡ 자동 설치 버튼. 실패 시 (EACCES 등) 카드 안 터미널 명령 fallback. polling effect 가 bodyInstall.installing 도 따라가도록 갱신.
  - **A. Claude 로그인 안내** — skills.ts 의 spawn close handler 가 stderr 의 auth 키워드 (`not authenticated`, `please run claude`, `/login`, `invalid api key` 등) 감지 시 "Claude 로그인이 안 되어 있어요. 터미널에서 `claude` 한 번 실행해 로그인한 뒤 다시 시도해 주세요." 로 메시지 변환. Claude Code 카드의 skill missing 분기에 "처음이면 터미널에서 `claude` 한 번 실행" 안내.
  - **A. pnpm 자동 설치** — `start.command` 가 pnpm 없으면 `npm install -g pnpm` 직접 spawn (실패 시 sudo 안내 fallback). Node.js 만 사용자가 직접 설치하면 끝.
  - **A. README 1-② 단순화** — "터미널 명령 4개" 섹션 제거. Node.js 설치만 사용자 작업, 나머지 (pnpm / Claude Code / Codex / slides-grab 기술) 는 모두 자동. 한 줄 흐름과 시간 정리표도 갱신 (10~20분).
  - **B. `Slides-Grab Studio.app` bundle** — Info.plist + `Contents/MacOS/SlidesGrabStudio` shell launcher. `.app` 더블클릭 → Terminal 에 `start.command` 띄움. macOS LaunchServices 가 `com.apple.application-bundle` 로 인식. start.command 는 호환성 위해 그대로 유지 (.app 이 내부 호출).
  - **B. README 매일 사용 흐름** — `start.command` 우클릭→열기 → `Slides-Grab Studio.app` 더블클릭으로. Dock 끌어다 두기 가능. 알려진 한계에 ".app 미서명 (Gatekeeper 첫 confirm 필요)" 한 줄 추가.
  - 결과: 비개발자 사용자가 터미널에 직접 칠 명령은 (a) 없거나 (b) Claude 첫 로그인 (`claude`) 한 줄만. 셋업 시간 20~35분 → 10~20분.
- 2026-05-20: 검토 후 안전성·UX 보강 (13개 항목, typecheck/lint 0 에러 도달).
  - **업로드 검증** — `app/api/uploads/route.ts` 에 파일당 50MB / 한 요청 200MB 상한 + 확장자 화이트리스트 (`.md/.txt/.pdf/.docx/.pptx`). `app/upload/page.tsx` dropzone 에 클라이언트 사전 검증 + 한 파일 한도 안내.
  - **서버 부팅 cleanup** — `lib/db/index.ts` 의 `getDb()` 가 첫 호출 시 `status IN ('generating', 'outlining')` deck 들을 `failed` 로 정리. dev server crash 후 박제되던 deck 자동 해제 (사용자가 다시 시도 가능).
  - **라이브러리 삭제 안내** — `app/page.tsx` 카드 그리드 하단에 "data/decks 폴더 삭제" 한 줄 (삭제 UI 는 Phase 2).
  - **outline .bak 백업** — `app/api/decks/[id]/outline/route.ts` PUT 직전 `slide-outline.md.bak` 복사. revision 없이 사용자가 직접 복구 가능한 최소 안전망.
  - **에러 메시지 톤** — `lib/decks/export.ts` (2곳), `lib/providers/skills.ts` 의 `code N` 영어 prefix 제거 → 한국어 안내. 자세한 exit code / stderr 는 `console.error` 로만.
  - **start 페이지** — "기술을 추가" 문구를 "둘 중 하나를 먼저 설치한 뒤 ⚡ 자동 설치 버튼" 으로 명확화. 푸터에 "현재 macOS 만 검증" 한 줄.
  - **`.idea` 정리** — `.gitignore` 에 `.idea/`, `.vscode/` 추가 + 기존 staged 항목 `git rm --cached -rf` 로 unstage.
  - **bulk-edit / export 충돌 메시지** — reject 메시지를 "지금 X 진행 중. 끝난 뒤 다시 시도해 주세요." 톤으로 통일.
  - **Lint 청소** — `app/deck/[id]/page.tsx` 의 unescaped `"` 13개를 한국어 typographic `“”` 로 통일. ref-during-render 1곳 `useEffect([editState])` 로 감쌈. setState-in-effect 3곳 (mount 1회 fetch 패턴, cascading 위험 없음 확인 후 disable + 주석). `lib/decks/generator.ts` 의 unused `_total` 제거.

---

## 6. 작업 항목 운영 룰 (이 프로젝트 내내 지키기)

1. 사용자 워크플로우 → mockup → 코드 (룰 1, CLAUDE.md). 새 화면도 mockup 먼저.
2. **AI 작업 자체에 손대지 마라.** skill 의 책임을 우리 prompt 에서 중복하지 않음.
3. 우리 앱 hard requirement (예: contentEditable 호환) 만 prompt 에 강조.
4. 비개발자 UI 텍스트는 쉬운 한국어 (영문 기술 용어 금지).
