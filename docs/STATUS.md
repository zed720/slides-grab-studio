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

**Phase 1 사양 완전 만족 + 내보내기 + Phase 2 (휴지통 + 내 양식 v1) + 배포 패키지까지 진행.**

`/` → `/start` → `/upload` → `/templates` → `/outline/[id]` → `/deck/[id]` 전체 흐름이 실제 AI 호출로 동작. 라이브러리에서 만든 deck 다시 보기 / 삭제(휴지통) / 복원 / 영구 삭제. 내보내기 4 형식 (PDF / PNG / PPTX / Figma) 중 PDF·PPTX·Figma 동작 (PNG 는 upstream packaging 누락으로 일시 비활성). **`/my-templates` 에서 회사 양식 (로고·주색·강조색·폰트) 등록 → `/templates` 픽커에 자동 노출 → 그 양식 선택하면 deck 가 그 brand 로 만들어짐** (사내 배포 시 슬라이드가 회사 색·로고로 일관되게 나옴). macOS 비개발자용 `.app` 번들 + ZIP 안에 `설치하기.command` 동봉으로 다운로드 → 우클릭→열기 한 번이면 `/Applications/` 자동 설치 + 실행까지.

남은 건 후속 polish (slides-grab upstream PR 머지, PNG 재활성) 와 내 양식 v2 (archetype 7종 갤러리) · v3 (AI 새 모양 만들기), 본격 Phase 2 (복제, 되돌리기 기록 등).

---

## 2. 남은 작업

### ✅ 완료 — 내보내기 (export) 기능 (2026-05-18)

deck → PDF / PPTX / Figma 다운로드 동작. PNG 만 일시 비활성 (slides-grab packaging 이슈, 아래 표 참고). 아래 작업 단위 기록은 향후 회고용으로 남겨둠.

**slides-grab CLI 옵션** (확인됨, `pnpm exec slides-grab pdf --help` 등):

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

### 다음 세션 우선순위

1. **slides-grab upstream PR 보내기** — `docs/upstream-prs/01-figma-graceful-validation.md`, `02-png-packaging.md` 두 본문 준비됨. 사용자가 GitHub 에 그대로 복사해서 보내면 됨. 머지되면 PNG export 도 자동 재활성 (한 줄 수정).
2. **Phase 2 본격 진입** — 휴지통은 끝났으니 그 다음 candidate: 복제 / 되돌리기 기록 / 회사 테마 중 사용자 우선순위 합의 후 진행.

### 그 외 (낮음)

| 우선순위 | 항목 | 비고 |
|---|---|---|
| ~~낮음~~ ✅ | ~~Codex provider e2e 검증~~ | 2026-05-18 완료 — 6장 deck 5분, slides-grab skill 자동 설치 + provider-aware prompt + `--skip-git-repo-check` 까지 |
| ~~낮음~~ ✅ | ~~dev server crash robustness~~ | 2026-05-20 완료 — `getDb()` 부팅 시 `status IN ('generating','outlining')` deck 들을 `failed` 로 자동 정리. 사용자가 다시 시도 가능 |
| ~~결정 보류~~ ❌ | ~~**card-news 워크플로우**~~ | 2026-05-21 **확정 — 안 함**. 1차 범위 밖. (slides-grab 자체는 `--mode card-news` 로 720×720 인스타 카드 지원하지만 우리 앱은 발표 16:9 만 유지. 미래에 필요해지면 별도 mini-flow 로 추가 가능.) |
| Phase 2 | 삭제 / 복제 / 휴지통 / 되돌리기 | 1차 범위 밖 |
| Phase 2 | 회사 테마 / 멀티 유저 / 모바일 | 1차 범위 밖 |
| 후속 | slides-grab upstream PR | 우리 contentEditable patch 를 본가에 기여 → 다음 버전부터 patch 불필요 |
| 후속 | **slides-grab PNG packaging 누락** | 1.2.6 / 1.3.0 둘 다 `bin/ppt-agent.js` 가 `scripts/html2png.js` 호출하나 `package.json#files` 에서 빠져 있음 → 우리 export 의 PNG 옵션 일시 비활성 (`DISABLED_FORMATS = ["png"]` in `lib/decks/export.ts` + ExportModal `pill: "soon"`). upstream 에 issue/PR 올리거나 patch 로 `html2png.js` 추가 후 Set 한 줄로 다시 활성. |

> "그 다음 작업 진행해" 한 줄이면 위 "다음 세션 우선순위" 1번 (upstream PR) 부터 시작합니다.

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
- **Figma export 결과물 quality** — graceful skip 패치로 거의 모든 deck 이 export 되지만, PptxGenJS 가 지원 못하는 시각 (div background-image / `<p>` border / 일부 inline margin 등) 은 결과 PPTX 에서 누락. console.warn 으로 어떤 게 빠졌는지 안내됨. 발표용은 여전히 PDF 권장.
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
- 2026-05-21: 카드뉴스 워크플로우 **확정 — 안 함** (1차 범위 밖 유지).
- 2026-05-21: A+ 배포 빌드 인프라 — Node + 의존성 + Chromium 까지 빌드 타임에 번들 (사용자 0 단계).
  - **A-1. data 위치 마이그레이션** — `lib/storage.ts:dataRoot()` 가 우선순위로 결정: (1) `SLIDES_GRAB_DATA_DIR` 환경 변수, (2) production+macOS 면 `~/Library/Application Support/Slides-Grab Studio/`, (3) fallback dev 의 `./data`. `lib/db/index.ts` + `lib/decks/cleanup-html.ts` 가 모두 dataRoot() 경유. **앱 업데이트 시 deck 데이터 자동 보존**.
  - **A-2. production standalone build** — `next.config.ts` 에 `output: "standalone"`. `.next/standalone/server.js` 단일 진입점. 빌드 검증 완료.
  - **A-3. Playwright 위치 통합** — slides-grab 이 spawn 으로 호출되므로 `PLAYWRIGHT_BROWSERS_PATH` 만 launcher 에서 export → 자동 상속. 코드 변경 0.
  - **A-4. .app launcher 갱신** — `Slides-Grab Studio.app/Contents/MacOS/SlidesGrabStudio` 가 두 모드 자동 분기: production (Resources/app/server.js 발견 시 번들된 Node 로 직접 server 실행 + Dock 종료 시 함께 죽음 + 로그 `~/Library/Logs/Slides-Grab Studio/server.log`) / dev fallback (Resources 비어있으면 기존 start.command 호출). arm64 / x86_64 자동 architecture 분기.
  - **A-5. 빌드 스크립트** `scripts/build-mac-arm64.sh` + `pnpm build:mac-arm64`. 9 단계: clean → frozen-lockfile install (patch 자동 적용) → standalone build → Node v20.18.0 arm64 다운로드 (캐시) → .app bundle 구조 (Node + standalone + .next/static + public + samples + slides-grab patch 검증) → Playwright Chromium 받기 (`.app/Contents/Resources/playwright-browsers/`) → dev artifacts 제거 → ad-hoc codesign + quarantine 제거 → zip. `/dist/Slides-Grab Studio.app` + `dist/Slides-Grab-Studio-mac-arm64.zip` 생성. `.gitignore` 에 `/dist`.
  - 첫 실측: zip 625MB → **160MB** 로 줄임. 원인: Playwright 가 chromium 본체 (341MB) + chromium-headless-shell (190MB) + ffmpeg (2.5MB) 모두 받음. slides-grab 은 `headless: true` 로 launch 하므로 chromium-headless-shell 만 있으면 충분. 빌드 스크립트의 `playwright install chromium` → `chromium --only-shell` + 사후 chromium-[숫자] / ffmpeg-[숫자] 폴더 제거로 다음 빌드는 처음부터 작음.
  - **빌드 디버깅 다섯 단계** (e2e 동작까지 도달):
    1. **better-sqlite3 native binary mismatch** — 빌드 시 시스템 Node (v25, NODE_MODULE_VERSION 141) 로 컴파일된 binary 가 standalone 에 들어감. 번들 Node v20 과 mismatch 로 dlopen 실패. 시도들: PATH 앞에 번들 Node, clean install, `pnpm rebuild` 모두 효과 없음 (pnpm store cache 가 hardlink). 최종 해결: **better-sqlite3 의 GitHub release 에서 prebuild binary 직접 받아 standalone 의 `.node` 파일 교체**.
    2. **better-sqlite3 prebuild 가 Node v20 용 없음** — v22/v24/v25 만 있음. 번들 Node 를 **v22.20.0 LTS** 로 올림 (NODE_MODULE_VERSION 127).
    3. **slides-grab CLI not found** — Next standalone tracing 이 spawn 으로 호출되는 `bin/ppt-agent.js` 의 종속을 못 추적해 `node_modules/slides-grab/` top-level symlink + `src/` 디렉토리가 빠짐. 해결: cwd 의 .pnpm 안 패키지를 standalone 에 overlay (없는 것만), slides-grab 패키지는 force overwrite (cwd 의 full 버전이 옳음).
    4. **commander 등 transitive deps not found** — slides-grab 의 production deps 모두 standalone tracing 빠짐. 해결: `pnpm prune --prod` 후 cwd 의 모든 .pnpm 디렉토리를 standalone 에 overlay.
    5. **prune 순서** — prune 이 step 5 에 있으면 step 6 (Playwright install) 이 fail (playwright 는 devDep). prune 을 Playwright install 후로.
    6. **architecture 감지** — launcher 의 `uname -m` 이 Rosetta 컨텍스트에서 x86_64 반환. `sysctl hw.optional.arm64` (하드웨어 레벨) 로 변경.
  - 최종 실측: **zip 337MB / .app 643MB**. 모든 API 200 (decks/providers/templates). 사이즈는 사용자 plan 의 ~120MB 보다 큼 (Next 169MB + sharp libvips 30MB + Chromium shell 190MB 합) — 추가 절감 가능하나 동작 확실.
- 2026-05-21: Phase 2 첫 단추 — 발표 자료 삭제 + 휴지통 흐름.
  - **DB 스키마** (migration v3) — `decks.deleted_at INTEGER NULL` 추가 + `idx_decks_deleted_at` 인덱스. 라이브러리는 `WHERE deleted_at IS NULL`, 휴지통은 `WHERE deleted_at IS NOT NULL`.
  - **쿼리 함수**: `listAllDecks` 가 살아있는 deck 만, 새 `listTrashedDecks` / `countTrashedDecks` / `softDeleteDeck` / `restoreDeck` / `permanentDeleteDeck`. `getDeck` 은 휴지통 안 deck 도 조회 가능 (복원 API 가 필요).
  - **API**:
    - `DELETE /api/decks/[id]` — soft delete (휴지통으로). 진행 중 (`generating`/`outlining`/`isExporting`/`isBulkEditing`) deck 은 409 로 거부.
    - `POST /api/decks/[id]/restore` — 복원.
    - `DELETE /api/decks/[id]/permanent` — 영구 삭제. DB 행 + 디스크 폴더 (`data/decks/<id>/`) 제거. 휴지통에 있는 deck 만.
    - `GET /api/decks/trash` — 휴지통 목록 (deletedAt 포함).
    - 기존 `GET /api/decks` 응답에 `trashCount` 추가.
  - **라이브러리 UI** (`app/page.tsx`):
    - 카드 hover 시 좌상단 `✕` 버튼 (우상단 status badge 와 안 겹침).
    - confirm dialog — "‘<title>’ 을 휴지통으로?" + "되돌릴 수 있어요" 안내. 진행 중에는 취소 막힘.
    - 헤더에 휴지통 있을 때만 `🗑️ 휴지통 (N)` 링크 표시 → `/trash`.
    - 라이브러리 하단 안내문 — "data/decks 폴더 삭제" → "카드 ✕ 로 휴지통" 으로 교체.
  - **휴지통 페이지** `/trash` — 회색조 카드 그리드 + 미리보기 위 🗑️ overlay. 각 카드에 `↩ 복원` (한 번에 라이브러리로) / `영구 삭제` (한 번 더 confirm). 빈 상태 안내 포함.
  - **mockup** — `docs/mockups/11-library-delete.html`, `12-trash.html` 사전 합의.
- 2026-05-21: Figma export 정상 동작 + upstream PR 초안 작성.
  - A. **친절 안내** — `lib/decks/export.ts` 의 runExport catch 에 `friendlyExportError(format, raw)` 추가. figma + "Background images on DIV elements" 키워드 감지 시 "이 디자인은 Figma Slides 로 변환할 수 없는 요소를 포함하고 있어요 (배경 이미지). 발표용으로는 PDF 를, 편집이 필요하면 PPTX 를 받아 주세요." 로 변환. `components/ExportModal.tsx` 의 figma desc 도 "디자인에 따라 변환이 아예 안 되는 경우가 있어요 (배경 이미지가 많은 템플릿 등)" 로 강화.
  - B. **graceful skip 패치** — `patches/slides-grab@1.2.6.patch` 에 두 변경 추가: (1) `html2pptx.cjs` 의 div background-image 케이스를 `errors.push + return` → silent skip (자식 element 처리는 계속). (2) 마지막 validationErrors 의 `throw new Error(...)` → `console.warn(...)`. 검증 에러가 있어도 전체 export 가 통째로 실패하지 않고 결과물이 일부 시각 누락된 채로 정상 생성. 실측: 우리 5장 deck 의 figma export — 변경 전 0KB 실패 → 변경 후 163KB PPTX 정상.
  - upstream PR 초안 두 개 작성: `docs/upstream-prs/01-figma-graceful-validation.md` (`figma` 명령의 graceful 처리), `docs/upstream-prs/02-png-packaging.md` (`package.json#files` 에 `scripts/` 누락 → `slides-grab png` 동작 안 함). 사용자가 GitHub PR 본문에 그대로 복사해서 보낼 수 있게.
- 2026-05-21: 수정 모드 — toolbar/사이드바 클릭 시 텍스트 변경이 저장 안 되던 버그 수정.
  - 원인: 우리 patch 는 `setSelectedObjectXPath` (= 다음 slide element 선택) 시점에만 save 호출. toolbar 의 next / ← 디자인 바꾸기 / ⬇ 내보내기 같은 슬라이드 바깥 클릭은 selection 을 바꾸지 않아 save 가 안 됨.
  - 해결: `patches/slides-grab@1.2.6.patch` 의 새 element 선택 시점에 `blur` 이벤트 리스너 추가. contentEditable 가 focus 잃으면 (iframe 바깥 클릭 / toolbar 클릭 / 다른 앱 전환 등) 즉시 `scheduleDirectSave(0, 'Slide text edited.')` 호출. 기존 cleanup 경로 (다음 element 선택 시) 도 그대로 유지 — 두 path 가 cover.
  - `pnpm patch` / `pnpm patch-commit` 으로 정식 재생성 (hunk header 자동 정확). 사용자 직접 검증 완료.
- 2026-05-21: editor selection overlay 누수 버그 수정 — 미리보기 화면에 녹색 점선 박스 + caret 보임.
  - 원인: 우리 contentEditable patch 가 selection 시점에 `contenteditable="true"`, `spellcheck="false"`, 녹색 dashed outline (`rgba(52, 211, 153, 0.7)`) 을 inline 박는데, slides-grab editor 의 throttled auto-save 가 사용자 입력 도중에 trigger 되면 그 상태 그대로 slide HTML 에 영구 저장됨. patch 의 cleanup 은 다음 element 선택 시점에만 실행되어 마지막 element + 종료 타이밍에 누수.
  - 3겹 우회: (a) `app/api/decks/[id]/slides/[idx]/route.ts` 응답마다 `stripEditorSelectionArtifacts` — 미리보기는 디스크 상태 무관하게 깨끗. (b) `lib/decks/cleanup-html.ts` 의 `cleanupAllSlideArtifacts` 부팅 시 한 번 traverse, 박힌 파일 strip 후 write-back. (c) `export.ts` 의 `runExport` 시작 직전 `cleanupDeckSlideArtifacts` 호출 — 같은 세션 동안 수정 → export 의 짧은 윈도우 차단 (PDF/PPTX 결과물에 박히는 사고 방지).
  - 후속 (선택): patches/slides-grab@1.2.6.patch 의 save 경로 자체에 strip hook 추가 — 디스크에 처음부터 안 박히게.
- 2026-05-20: `start.command` 진행률 시각화 — 첫 실행 동안 사용자 막막함 해소.
  - 4 단계 헤더 (`▶ ...`) 와 단계별 ✓ + 소요 시간 표시 (`SECONDS` 변수 활용, 60초 넘어가면 분/초 분리).
  - 의존성 + Chromium 단계 분리 — "라이브러리 받는 중 (1~2분)" / "Chromium 받는 중 (3~5분, ~150MB)" 별도 라벨 + 각각 ✓.
  - Chromium 캐시 (`~/Library/Caches/ms-playwright/chromium-*`) 존재 시 단계 자체 skip — 2번째 실행부터는 보이지도 않음.
  - 브라우저 자동 open 을 고정 3초 sleep → `curl http://localhost:3000` polling (2초 간격, 최대 2분) 으로 교체. Next dev 첫 컴파일 (30초~1분) 끝나야 응답 시작하므로 빈 페이지 회피. 응답 시 "✓ 서버 준비 완료 — 브라우저 열어요." 출력.
- 2026-05-20: 환영 화면 (C 옵션) — 라이브러리 EmptyState 자리에 deck 0개일 때만 노출.
  - mockup `docs/mockups/10-welcome.html` — hero (🎬 환영합니다) + 3 단계 안내 카드 + 샘플 빠른 시작 + 큰 시작 버튼 + footer.
  - `app/page.tsx` 의 `EmptyState` → `WelcomeScreen` 으로 교체. 첫 deck 만들면 자동으로 카드 그리드로 전환.
  - 샘플 빠른 시작 — `GET /api/samples/[name]` (화이트리스트: `team-retro`, `onboarding`) 가 `samples/` 의 .md 를 읽어 `{title, content}` 반환. 환영 화면의 두 버튼 → `/start?sample=<name>` → start 가 query 전달 → upload 가 mount 시 fetch + 폼 자동 채움 + 파란 callout "샘플로 시작했어요. 그대로 다음 단계로 가셔도 되고, 본문을 수정하셔도 돼요".
  - `app/start/page.tsx` — `useSearchParams` 도입 (Suspense + Inner 분리, upload 페이지와 같은 패턴).
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
- 2026-05-25: `.app` launcher PATH 보강 — Finder/launchd 가 띄운 `.app` 의 PATH 가 `/usr/bin:/bin:/usr/sbin:/sbin` 뿐이라 brew·`~/.local/bin`·`~/.npm-global`·volta·nvm 등에 설치된 `claude`/`codex` 를 못 보던 문제 (provider 점검 화면이 "설치 안 됨" 으로 잘못 표시). `Slides-Grab Studio.app/Contents/MacOS/SlidesGrabStudio` 가 production 분기에서 `/bin/zsh -ilc 'printf %s "$PATH"'` 로 사용자 인터랙티브 셸의 PATH 를 한 번 평가해서 export. zsh 실패 시 bash fallback, 둘 다 실패하면 `$HOME/.local/bin:$HOME/.npm-global/bin:$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin` 안전망 추가. dev fallback 분기는 어차피 Terminal 에서 띄우는 거라 PATH 가 정상 → 영향 없음.
- 2026-05-25: 배포 ZIP 안에 설치 스크립트 동봉 — 사용자가 다운로드 후 `.app` 만 더블클릭 → Gatekeeper 가드에 막혀 헤매던 흐름 단축. `scripts/installer-template/{설치하기.command,읽어보기.txt}` 신설, `scripts/build-mac-arm64.sh` step 9 가 ZIP 묶기 전에 `dist/Slides-Grab Studio/` 폴더 만들어서 `.app` + 두 파일 같이 넣음. `설치하기.command` 는 우클릭→열기 한 번이면 (1) quarantine 제거 (2) `/Applications/` 로 복사 (권한 부족 시 sudo fallback) (3) 자동 실행 (4) 3초 뒤 터미널 자동 닫힘. 두 번째부터는 런치패드/Applications 에서 그냥 클릭. `읽어보기.txt` 는 "처음 한 번은 우클릭→열기" 안내 + 트러블슈팅.
- 2026-05-25: 내 양식 v1 — 사내 배포를 위한 회사 브랜드 양식. 비개발자가 회사 로고·주색·강조색·폰트를 한 번 등록하면 새 deck 만들 때 그대로 적용. 사용자 지적 ("slides-grab 디자인 셋이 개인용이라 회사용으로 맞춤 안 됨") 해결. **v1 범위는 brand kit 만** — archetype 갤러리 (표지/목차/본문/표/차트/이미지/마무리 7종) 는 v2, AI 새 모양 만들기는 v3 (mockup `docs/mockups/14-template-builder.html` 의 1번 섹션만 구현, 2번 섹션은 placeholder).
  - **DB**: migration v4, `custom_templates` 테이블 (id, name, brand_json, created_at, updated_at, deleted_at). brand_json = `BrandKit { primaryColor, accentColor, fontFamily, logoPath }` 직렬화. soft delete (decks 와 같은 패턴).
  - **타입 + queries**: `lib/custom-templates/types.ts` (`BrandKit`, `DEFAULT_BRAND_KIT`, `ALLOWED_FONTS` 5종), `lib/db/queries/custom-templates.ts` (CRUD + soft delete + `parseBrand`).
  - **로고 디스크 저장**: `lib/storage.ts:customTemplatesDir(id)` = `dataRoot()/custom-templates/<id>/`. 로고 파일명 `logo.{png,jpg,jpeg,svg,webp}`, 5MB 상한, 화이트리스트.
  - **API**: `app/api/my-templates/` 5 라우트 — `GET/POST` (목록·생성), `[id]/{GET,PATCH,DELETE}` (CRUD), `[id]/logo/{POST,DELETE}` + `logo/file/GET` (업로드/삭제/서빙). hex 색은 `#RRGGBB` 검증, 폰트는 `ALLOWED_FONTS` 화이트리스트, logoPath 는 별도 업로드 API 에서만 갱신.
  - **빌더 미리보기**: `lib/custom-templates/preview.ts:buildPreviewHtml()` — brand kit 으로 sample 표지 슬라이드 HTML 생성 (로고 + 큰 제목 + rule line). `GET /api/my-templates/[id]/preview?primary&accent&font` — DB 의 brand 가 기본, query 로 override (빌더가 저장 전에 색 바꾸는 중에도 iframe 가 즉시 반영하게).
  - **컴포넌트**: `components/ColorPicker.tsx` (네이티브 input[type=color] swatch + hex 입력 + 프리셋 6개 + recent), `components/MyTemplateBuilder.tsx` (mockup 14 의 1번 섹션 그대로 — 로고/주색/강조색/폰트 4셀 grid + 라이브 미리보기 iframe + sticky 저장 바). archetype 섹션은 placeholder 카드 ("다음 업데이트").
  - **페이지**: `/my-templates` 목록 (iframe preview 카드 + 새로 만들기 + 삭제), `/my-templates/new` (POST 후 redirect), `/my-templates/[id]` (server component → MyTemplateBuilder). TopNav 가 active step 없을 때만 "내 양식" 보조 링크 노출 (deck 만드는 흐름 중간엔 step crumbs 우선).
  - **/templates picker 통합**: `/api/templates` 가 custom 도 같이 반환 (id 에 `custom:` prefix). `/templates` 페이지의 `TemplateCard` 가 custom 인 경우 좌상단 "내 양식" 배지 + preview iframe 직접 (modal 진입 X). 사용자 양식이 항상 slides-grab 35종 위에 표시.
  - **핵심 — deck 생성에 brand 주입**: `generator.ts:styleInstruction()` 이 `template_id` 가 `custom:<uuid>` 시작이면 DB 에서 brand 읽어 `brandKitToInstruction()` 으로 AI prompt instruction text 박음. **BITREE 패턴 재사용** — 별도 slides-grab 통합 spike 불필요, `BITREE_DESIGN_INSTRUCTIONS` 와 같은 길로 사용자 양식이 prompt 에 들어감. 양식이 지워져 있으면 instruction 없이 진행 (slides-grab 기본 디자인 fallback).
  - **검증**: typecheck + lint clean (기존 dist/ minified 코드 잡히는 false positive 제외). e2e (양식 만들기 → deck 생성 → 결과 확인) 사용자 실측 통과 (2026-05-25, 보라 #7C3AED + 노랑 #FFC107 + BR 로고 → 만든 deck 의 슬라이드들이 그대로 그 색·로고로 생성됨 확인).
- 2026-05-25: 내 양식 v2 minimal — archetype 갤러리 (표지·본문 × 2안). v1 의 brand kit 위에 사용자가 archetype 별로 모양 픽 → generator prompt 에 그 archetype HTML 예시 박힘 → AI 가 새 콘텐츠로 같은 layout 만듦. 4 옵션: COVER_A "단정한 좌측" / COVER_B "풀 컬러 강조" / BODY_A "좌 헤딩+우 본문" / BODY_B "불릿 위주". BITREE 패턴 재확장 — `brandKitToInstruction()` 이 archetypes 받으면 `### 표지 슬라이드 ###` `### 본문 슬라이드 ###` 섹션 추가, 각각 옵션 sample HTML 박음 (strong anchor). preview API 도 cover archetype 받아 즉시 반영 (BR placeholder span → 로고 <img> 후처리 교체). 새 파일: `lib/custom-templates/archetypes.ts` (4 옵션 + ARCHETYPES 카탈로그 + getArchetypeOption), `components/ArchetypePicker.tsx`. 기존 brand_json 안 nested key 추가만이라 DB migration 불필요. v2b 에서 나머지 5 archetype (목차/표/차트/이미지/마무리) 추가 예정 — `archetypes.ts` 데이터만 추가하면 UI/instruction 변경 없이 확장.

---

## 6. 작업 항목 운영 룰 (이 프로젝트 내내 지키기)

1. 사용자 워크플로우 → mockup → 코드 (룰 1, CLAUDE.md). 새 화면도 mockup 먼저.
2. **AI 작업 자체에 손대지 마라.** skill 의 책임을 우리 prompt 에서 중복하지 않음.
3. 우리 앱 hard requirement (예: contentEditable 호환) 만 prompt 에 강조.
4. 비개발자 UI 텍스트는 쉬운 한국어 (영문 기술 용어 금지).
