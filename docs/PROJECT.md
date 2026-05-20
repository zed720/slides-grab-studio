# Slides-Grab Web Studio — Project Overview

> 이 문서는 PRD.md를 압축한 살아있는 요약본이다. 큰 의사결정이 바뀔 때만 갱신한다.
> 상세 배경은 `PRD.md`를, 진행 상태는 `docs/STATUS.md`를 본다.

---

## 1. 이 프로젝트가 뭔가

`NomaDamas/slides-grab`을 기반으로, **비개발자가 터미널을 열지 않고 로컬 브라우저에서 AI 슬라이드를 만들 수 있게** 해 주는 로컬 웹 앱이다.

- slides-grab의 HTML/CSS 슬라이드 엔진, 편집기, 검증, export 기능은 **재사용**한다. 다시 만들지 않는다.
- 이 프로젝트는 그 위에 얹는 **사용자 친화 UI 레이어**다.

## 2. 핵심 페르소나

**사내 문서 작성자 (비개발자).** 회사 소개, 보고, 세일즈, 행사 발표 자료를 만든다. CLI 무서워한다. 디자인 전문가는 아니지만 "예쁘고 일관된 장표"를 원한다.

## 3. 1차 범위 — 단 4 화면, 단 한 흐름

```
[1] AI 도구 설치 확인 (gate)
       ↓
[2] 발표 내용 올리기 (제목 + 텍스트 또는 파일)
       ↓
[3] 디자인 고르기 (slides-grab 템플릿을 HTML 견본 카드로)
       ↓
[4] 슬라이드 미리보기 + 수정 (slides-grab 웹 에디터 임베드)
```

각 화면의 정적 mockup은 `docs/mockups/`에 있다. 동작 사양의 기준이다.

## 4. 명시적으로 1차 범위 밖

- 발표 자료 삭제 / 복제 / 휴지통
- 되돌리기 기록 (history / rollback)
- 내보내기 센터 (PDF/PPTX/Figma export)
- 회사 디자인 / 브랜드 규칙 / 정책 설정
- outline 별도 단계, "발표 자료가 만들어지기 전에 목차 확인"
- 멀티 유저 / 클라우드 동기화 / 권한
- 모바일 최적화

이 항목들은 PRD에는 들어있지만 Phase 1 산출물에서는 메뉴/버튼 노출도 하지 않는다.

## 5. 비기능 요구사항 (최소 합의)

- **로컬 우선**: 모든 데이터는 로컬 디스크에 둔다. 외부 SaaS 호출 없음.
- **gate 동작**: AI 도구 미설치 시 화면 2 진입 자체를 막는다.
- **언어**: 사용자 UI 텍스트는 비개발자용 쉬운 한국어. 영문 기술 용어 직접 노출 금지 (코드 내부는 영어 OK).
- **응답 시간**: 사용자가 누른 버튼은 즉시 반응. 오래 걸리는 작업은 진행률 표시.
- **안전**: 사용자 폴더 바깥의 임의 디렉터리에 쓰지 않는다.

## 6. 기술 스택 (확정)

- **앱**: Next.js (App Router) + Node.js 로컬 서버 단일 레포
- **언어**: TypeScript
- **스타일**: Tailwind CSS (mockup의 디자인 토큰 그대로 가져옴)
- **패키지 매니저**: pnpm
- **DB**: SQLite (`better-sqlite3`) — 단일 파일, 서버 없음
- **slides-grab 통합 방식**: 미정. Phase 1 T2 단계에서 결정 (git submodule이 기본 후보).
- **AI 도구 호출**: subprocess (Claude Code / Codex CLI) — provider 추상화 인터페이스로 감쌈

## 7. 핵심 데이터 모델 (1차)

```
Project { id, name, workspacePath, createdAt }
Deck    { id, projectId, title, status, slideCount, createdAt, updatedAt }
Slide   { id, deckId, filePath, order, updatedAt }
ProviderStatus { provider, installed, authenticated, version, lastCheckedAt }
```

Revision / ExportJob 등은 1차 범위 밖.

## 8. 디렉터리 구조 (목표)

```
bitreespark_II/
├── PRD.md                    # 원본 PRD (편집 금지)
├── CLAUDE.md                 # 에이전트 규칙
├── AGENTS.md                 # 서브에이전트 가이드
├── docs/
│   ├── PROJECT.md            # 이 문서
│   ├── STATUS.md             # 현재 진행 상태
│   ├── PHASE_1_PLAN.md       # Phase 1 작업 계획
│   └── mockups/              # 정적 HTML 목업 (디자인 기준)
├── app/                      # Next.js App Router
├── components/
├── lib/
│   ├── providers/            # Claude/Codex 추상화
│   ├── slides-grab/          # slides-grab 호출 어댑터
│   └── db/                   # SQLite 스키마/마이그레이션
├── public/
├── vendor/
│   └── slides-grab/          # submodule 후보 위치
└── data/                     # 런타임 SQLite + workspace 인덱스
```

## 9. 명시적 비기술 결정

- **워크플로우 → 목업 → 코드 순서를 절대 어기지 않는다.** 백엔드/스택 결정을 사용자 워크플로우 합의 전에 먼저 들이밀지 않는다.
- **잡기능 임의 추가 금지.** 1차 범위 밖 메뉴/버튼은 화면에 두지 않는다.
- **slides-grab 기능은 재구현하지 않는다.** 편집기, 뷰어, 검증, export는 모두 slides-grab의 산출물을 그대로 사용한다.
- **템플릿은 하드코딩하지 않는다.** slides-grab이 노출하는 템플릿을 동적으로 받아 HTML 견본 카드로 렌더한다.
