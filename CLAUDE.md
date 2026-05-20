# CLAUDE.md — 이 레포에서 작업하는 에이전트가 가장 먼저 읽는 문서

> 매 세션 처음 이 파일을 본다. 그 다음 `docs/STATUS.md`로 현재 위치를 확인한다.

---

## 1. 한 줄 요약 (본질)

**CLI 로 Claude Code 와 하는 slides-grab 작업을 그대로 웹 UI 로 옮긴 wrapper.** 비개발자가 터미널 없이 로컬 브라우저에서 같은 결과를 받게 한다. 자세한 내용은 [`docs/PROJECT.md`](docs/PROJECT.md).

> 우리 앱의 가치는 **UI + 파일 관리 + 진행 시각화 + contentEditable patch**. AI 작업 자체 (사이즈/태그/폰트/분량/wrapping) 는 slides-grab skill 의 책임이고 우리 prompt 에서 중복 명시하지 않는다.

## 2. 절대 어기지 않는 규칙

1. **작업 순서**: 사용자 워크플로우 합의 → 목업 UI 합의 → 그 다음 코드. 백엔드 / 기술 스택 / DB 결정을 워크플로우 전에 먼저 꺼내지 않는다.
2. **사용자 UI 텍스트는 쉬운 한국어**. workspace / provider / outline / rollback / bbox / snapshot 같은 영문 기술 용어를 그대로 사용자에게 보여주지 않는다. 치환표는 [`docs/PROJECT.md`](docs/PROJECT.md)에 없으면 메모리 `feedback-no-jargon` 참조.
3. **1차 범위 밖 기능은 만들지도, 메뉴에 노출하지도 않는다.** 삭제 / 복제 / 휴지통 / 되돌리기 기록 / 내보내기 센터 / 회사 브랜드 / 멀티 유저 등은 Phase 1 에서 다루지 않는다. PRD에 있다는 이유로 알아서 추가하지 말 것.
4. **slides-grab 기능은 재구현 금지**. 편집기 / 뷰어 / 검증 / export 는 slides-grab의 결과물을 그대로 임베드 또는 호출한다.
5. **템플릿은 하드코딩 금지**. 디자인 카드는 slides-grab이 제공하는 템플릿을 동적으로 받아 HTML 견본으로 렌더링한다.
6. **AI 작업 prompt 에 중복 룰 박지 않는다.** 사이즈/태그/분량/wrapping 같은 건 slides-grab skill 자체가 알고 있다. 우리 prompt 는 4가지만 명시: (a) 입력 파일 위치, (b) 출력 위치, (c) non-interactive 자동 승인, (d) 스타일 id. + 우리 앱 hard requirement (수정 도구 호환 위해 div 안 직접 텍스트 X) 한 줄.

## 3. 핵심 워크플로우 (변경 금지)

```
[1] AI 도구 설치 확인  →  [2] 내용 올리기  →  [3] 디자인 고르기  →  [4] 슬라이드 보기·수정
```

각 화면의 디자인 기준은 `docs/mockups/0X-*.html`에 있다. UI 변경은 mockup 먼저 갱신, 그 다음 코드.

## 4. 기술 스택

| 영역 | 결정 |
|---|---|
| 앱 | Next.js (App Router) |
| 언어 | TypeScript |
| 스타일 | Tailwind CSS (mockup의 디자인 토큰 이식) |
| 패키지 매니저 | pnpm |
| DB | SQLite via `better-sqlite3` |
| AI 호출 | subprocess (Claude Code / Codex CLI) — `lib/providers/` 추상화 뒤에서 |
| slides-grab | `vendor/slides-grab` (방식은 Phase 1 T2에서 확정) |

## 5. 디렉터리 규약

- `app/` — Next.js 라우트. 4 화면 = 4 라우트.
- `components/` — 재사용 UI 컴포넌트.
- `lib/providers/` — Claude / Codex 등 AI 도구 추상화.
- `lib/slides-grab/` — slides-grab CLI 호출 어댑터.
- `lib/db/` — SQLite 스키마, 마이그레이션, 쿼리.
- `vendor/slides-grab/` — slides-grab 자체 (git ignore 또는 submodule).
- `data/` — 런타임 SQLite 파일, 사용자 workspace 인덱스 (git ignore).
- `docs/mockups/` — 정적 HTML 디자인 기준. 코드 동작과 mockup이 어긋나면 mockup이 정답.
- `PRD.md` — 원본 PRD. **편집 금지**, 참고용.

## 6. 자주 쓸 명령어 (Phase 1 진입 후)

```bash
pnpm install            # 의존성 설치
pnpm dev                # 개발 서버 (localhost:3000)
pnpm build              # 프로덕션 빌드
pnpm lint               # ESLint
pnpm typecheck          # tsc --noEmit
pnpm test               # vitest (있으면)
```

> 위 명령어들은 Phase 1 T1 (스캐폴드) 완료 후 실제로 동작한다. 그 전까지는 README 참고.

## 7. 세션 시작 / 종료 체크리스트

**시작 시**
1. 이 파일 (CLAUDE.md) 읽기
2. `docs/STATUS.md` 읽기 — 현재 Phase, 마지막에 멈춘 지점, 다음 작업 확인
3. 필요하면 `docs/PHASE_1_PLAN.md` 또는 진행 중 task 문서 확인

**종료 시**
1. `docs/STATUS.md` 갱신 — 완료한 것 / 다음 할 일 / 새로 생긴 미해결 결정
2. 작업한 파일들 커밋 (사용자가 명시적으로 요청한 경우만)

## 8. 결정 / 피드백을 기록하는 위치

- **재발 가능한 행동 규칙** (예: "용어 X 쓰지 마라"): 에이전트 메모리에 feedback 타입으로 저장.
- **이 프로젝트만의 사실** (예: "현재 Phase, 다음 task"): `docs/STATUS.md`.
- **장기적인 프로젝트 구조 결정** (예: "DB는 SQLite로 간다"): `docs/PROJECT.md`.
- **PRD 자체 변경**: 사용자가 명시적으로 요청한 경우에만. 변경 이력은 git log에서 본다.

## 9. 비상시 행동

- 사용자의 지시가 이 문서와 충돌하면 **사용자 지시가 우선**.
- 한 가지가 PRD에 있는데 사용자가 1차 범위 밖이라고 한 경우, **사용자 지시 우선**.
- 모르겠으면 작업 멈추고 사용자에게 한 문장으로 묻는다. 추측해서 진행하지 않는다.

## 10. 관련 문서

- [`PRD.md`](PRD.md) — 원본 제품 요구사항 (편집 금지)
- [`docs/PROJECT.md`](docs/PROJECT.md) — PRD 압축 + 1차 범위 정의
- [`docs/STATUS.md`](docs/STATUS.md) — 현재 진행 상태
- [`docs/PHASE_1_PLAN.md`](docs/PHASE_1_PLAN.md) — Phase 1 작업 단위
- [`AGENTS.md`](AGENTS.md) — 서브에이전트 가이드
- [`docs/mockups/`](docs/mockups/) — UI 디자인 기준
