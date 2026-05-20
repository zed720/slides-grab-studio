# Slides-Grab Web Studio

발표 자료를 **AI 가 만들어 주는** 웹 앱이에요. 본인 노트북에서 돌아가요.

> 평소에 ChatGPT/Claude 한테 "이 내용으로 슬라이드 만들어줘" 하던 그 작업을, 더 편한 화면으로 정리해 둔 도구라고 생각하시면 돼요.

---

## 한 줄 흐름

```
Node.js 설치 (3~5분)  →  start.command 더블클릭  →  화면 1 에서 [⚡ 자동 설치]  →  4 단계 → PDF 다운로드
```

매일 사용은 더블클릭 한 번. 5초.

---

## 1. 처음 한 번만 — 설치 (10~15분)

### 1-① Node.js 설치 (3~5분)

1. Safari 로 [nodejs.org/ko](https://nodejs.org/ko/) 열기
2. 큰 초록 버튼 중 **"LTS"** 라고 적힌 거 클릭 → `.pkg` 자동 다운로드
3. 다운로드 폴더의 `.pkg` 더블클릭 → "계속" "계속" "동의" "설치" → 비밀번호 → "닫기"

> Apple Silicon (M1/M2/M3) Mac 이면 자동으로 Apple Silicon 버전, Intel 이면 x64 버전이 선택돼요.

**확인** (선택) — 터미널 (Spotlight → "터미널" → 엔터) 에서:
```
node -v
```
→ `v20.x.x` 같은 게 나오면 OK.

> 💡 **여기까지가 끝이에요.** 나머지 도구 (pnpm / Claude Code / Codex / slides-grab 기술) 는 **우리 앱이 화면 1 에서 자동으로 설치**해 줘요. 터미널에 직접 입력할 명령은 없어요. (Claude 첫 로그인 한 번만 제외.)

### 1-② 우리 앱 압축 풀기 (1분)

1. 받은 `bitreespark.zip` 더블클릭 → `bitreespark_II` 폴더 풀림
2. 그 폴더를 **데스크탑** 같은 잘 보이는 곳으로 옮기기

### 1-③ Claude 또는 ChatGPT 구독 확인

> ❗ Claude **Pro ($20/월)** 또는 **Max ($100/월)** 구독이 있어야 슬라이드를 만들 수 있어요. [claude.ai](https://claude.ai/) 에서 먼저 가입.
>
> 💡 **ChatGPT Plus/Team 사용자**라면 Claude 대신 Codex 를 사용하셔도 됩니다. 둘 중 한 구독만 있으면 돼요.

---

## 2. 매일 사용 — 더블클릭

### 2-① 첫 실행 (5~10분, 한 번만 오래 걸림)

폴더 안의 **`Slides-Grab Studio.app`** 더블클릭. (Finder 에서 아이콘이 일반 앱처럼 보여요. 다른 앱처럼 Dock 에도 끌어다 둘 수 있어요.)

**"확인되지 않은 개발자" 경고가 뜨면**:
- **마우스 오른쪽 클릭 → 열기 → "열기"** (한 번만 이렇게)
- 다음부터는 그냥 더블클릭으로 OK

> 💡 만약 `.app` 이 안 보이거나 동작이 이상하면, 같은 폴더 안 `start.command` 를 우클릭→열기 해도 동일하게 동작해요. (.app 은 안에서 start.command 를 호출.)

터미널 창이 자동으로 열리고:

```
🎬 Slides-Grab Web Studio 켜는 중…
📦 처음이라 부품들을 받아올게요 (5~10분 걸려요)…
   - 라이브러리 의존성
   - PDF 만들기에 필요한 Chromium (~150MB)
```

가 보임. **창 닫지 말고 기다리기**. 5~10분 후 **브라우저가 자동으로 `http://localhost:3000` 을 엽니다**.

### 2-② 화면 1 — AI 도구 자동 설치 (2~5분)

처음이라면 양쪽 카드 모두 **"설치 안 됨"** 으로 보일 거예요:

```
Claude Code                       Codex
✗ 설치 안 됨                     ✗ 설치 안 됨
   [⚡ 자동 설치]                    [⚡ 자동 설치]
```

**한 카드의 [⚡ 자동 설치] 클릭** → 우리 앱이 직접 설치 진행 (터미널 열 필요 없음):

```
Claude Code
✓ 설치됨 · 버전 2.x.x
✗ slides-grab 기술 안 됨
   [⚡ 자동 설치]                ← 한 번 더 클릭
```

다시 **[⚡ 자동 설치]** → 잠시 후:

```
Claude Code
✓ 설치됨 · 버전 2.x.x
✓ slides-grab 기술 설치됨
   [이걸로 사용]
```

→ **이걸로 사용** 클릭 → **다음으로 →**

> 💡 **Claude 첫 로그인** — Claude Code 설치 후 slides-grab 기술 설치 단계에서 "Claude 로그인이 안 되어 있어요" 라는 안내가 뜨면, 터미널 (Spotlight → "터미널") 에서 `claude` 한 번 실행 → 브라우저로 자동 로그인 → `/quit`. 다시 화면 1 으로 돌아와 [⚡ 자동 설치] 한 번 더 누르면 끝. (Codex 는 별도 로그인 절차 없이 자동 설치만으로 OK.)

> 💡 둘 다 동작합니다. **Claude Pro/Max** 가 있으면 Claude Code 권장 (검증 더 많음). **ChatGPT Plus/Team** 으로 Codex 쓰셔도 6장 deck 약 5분에 완성됩니다.

### 2-③ 화면 2 — 내용 올리기

- **제목** (예: "2026년 1분기 팀 회고")
- **내용** — 두 가지 길:
  - 직접 입력: 메모, 회의록, 보고서, 글 그대로 붙여넣기
  - 파일 업로드: `.md` / `.txt` / `.pdf` / `.docx`
- **첫 시도면 [`samples/01-팀-회고.md`](./samples/01-팀-회고.md) 올려 보기**
- 분량 / 분위기 칩 선택 (선택)
- **다음으로 →**

### 2-④ 화면 3 — 디자인 고르기

- 35종 디자인 카드
- 마음에 드는 분위기 카드 클릭 → 테두리에 체크
- 더 큰 미리보기는 카드 좌상단 `⛶` 아이콘
- **시작하기 →**

### 2-⑤ 화면 4 — 슬라이드 보기·수정 (AI 작업 중)

```
[발표 구조 잡는 중…]    [▓▓░░░░░░░] 0 / 10장
```

3~10분간 AI 가 슬라이드 만듦. 라벨이 순서대로:
- "발표 구조 잡는 중…" → "슬라이드 그리는 중" → "마무리 검토 중…" → "완성"

**먼저 만들어진 슬라이드부터 미리보기 가능** — 왼쪽 썸네일 클릭.

### 2-⑥ 완성 후 — 수정 / 내보내기

오른쪽 위 버튼:
- **← 디자인 바꾸기** — 화면 3 다시
- **✨ 전체 수정** — "여백 다 맞춰줘" 같은 자연어로 일괄 수정
- **⬇ 내보내기** — PDF / PPTX / Figma 받기 (PDF 권장)
- **✎ 수정하기** — 슬라이드 글자 직접 클릭해서 고치기

**⬇ 내보내기 → PDF → 만들기 시작** → 30초~1분 → **다운로드** 버튼 → 파일 받아짐.

### 2-⑦ 끄기

- 터미널 창 닫기 → 서버 자동 종료
- 또는 그 창에서 `Ctrl + C`

---

## 3. 두 번째 사용부터 — 정말 더블클릭 한 번

1. `bitreespark_II` 폴더의 **`Slides-Grab Studio.app`** 더블클릭 (5초)
2. 브라우저 자동 open
3. **내 발표 자료** 화면 → 만든 자료 카드들
4. 새 자료 만들기 → 위 2-③ ~ 2-⑥ / 기존 카드 클릭 → 다시 보기·수정
5. 카드 우하단 **⬇ 빠른 다운로드** 버튼으로 페이지 안 들어가도 PDF 받기 가능

> 💡 `Slides-Grab Studio.app` 을 Dock 또는 Applications 폴더에 끌어다 두면 매번 폴더를 안 열어도 돼요. (단 .app 은 원래 위치의 `start.command` 를 호출하므로 `bitreespark_II` 폴더 자체는 지우지 마세요.)

만든 자료는 `bitreespark_II/data/` 에 저장돼서 안 없어져요.

---

## 4. 자주 만나는 막힘

| 증상 | 해결 |
|---|---|
| `start.command` 더블클릭하면 "보안" 경고 | 마우스 우클릭 → 열기 → 확인 (한 번만) |
| 터미널에서 `Node.js is not installed` | nodejs.org/ko 에서 LTS .pkg 다시 설치 |
| 화면 1 ⚡ 자동 설치 후에도 "설치 안 됨" | 카드의 빨간 박스 안내대로 한 줄 복사 → 터미널 붙여넣기 (권한 문제일 가능성) |
| Claude Code 카드 ⚡ 기술 자동 설치가 "Claude 로그인 필요" 에러 | 터미널에서 `claude` → 브라우저 자동 로그인 → `/quit` → 다시 [⚡ 자동 설치] |
| 화면 4 진행 막대가 5분 이상 멈춤 | 터미널 창 닫고 `start.command` 다시. 만든 슬라이드는 그대로 남음 |
| PDF 만들기 실패 | 다시 시도. 그래도 실패면 그래디언트 많은 디자인일 수 있어요. 다른 디자인 시도 |
| 포트 3000 이미 사용 중 | 터미널: `lsof -ti:3000 \| xargs kill` |
| 자동 설치가 5분 넘게 안 끝남 | 한 번 더 클릭하거나 카드 아래 명령을 복사해 터미널에서 직접 실행 |

---

## 5. 시간 정리

| 시점 | 소요 |
|---|---|
| Node.js 설치 (한 번만, GUI .pkg) | 3~5분 |
| 첫 실행 (`start.command`) — pnpm 자동 설치 + 의존성 + Chromium ~150MB | 5~10분 |
| 화면 1 의 [⚡ 자동 설치] — AI 도구 본체 + slides-grab 기술 | 2~5분 |
| **여기까지 = 처음 한 번만**, 합치면 | **10~20분** |
| 매일 켜기 | 5초 |
| 발표 자료 1개 만들기 (입력 → PDF) | 5~15분 |

---

## 6. 자주 묻는 질문

**Q. 비용이 얼마예요?**
A. 이 앱 자체는 무료. **Claude Pro ($20/월) 또는 Max ($100/월) 구독은 필요**. 한 발표 자료 만들 때 본인 Claude 토큰을 사용해요 (Pro 면 ~$0.3~1 정도, Max 는 한도 내 무료).

**Q. 인터넷 없이도 돼요?**
A. AI 가 Claude 서버를 호출하므로 **인터넷 필수**. 만든 자료 보기·수정·PDF 다운로드는 인터넷 없이도 OK.

**Q. 만든 자료가 어디에 저장돼요?**
A. 앱 폴더 안의 `data/decks/<긴 id>/` 에. 폴더 통째로 옮겨도 데이터 따라가요.

**Q. 다른 사람과 같이 쓸 수 있어요?**
A. 한 명 한 노트북. 만든 결과물만 PDF/PPTX 로 공유.

**Q. 갑자기 멈췄어요 / 진행 막대가 안 움직여요.**
A. AI 가 작업 중일 수 있어요. 5분 이상 안 움직이면 터미널 창 닫고 다시 `start.command`. 만든 슬라이드까지는 유지돼요.

**Q. 만든 발표 자료를 삭제하고 싶어요.**
A. 지금은 UI 에 없어요. `data/decks/<긴 id>/` 폴더를 파일 탐색기에서 직접 지우세요.

**Q. 비밀 정보 (회사 기밀 등) 넣어도 돼요?**
A. 이 앱은 본인 노트북에서만 돌지만, 본문 내용은 **Claude (Anthropic) 또는 ChatGPT (OpenAI) 가 읽어요**. 회사 보안 정책 확인 후 사용.

**Q. Claude vs Codex 어느 게 좋아요?**
A. **Claude Code 가 검증 더 많음** (slides-grab 의 메인 타겟). Codex 도 6장 deck 5분 안에 만들 수 있고 검증 완료. 본인이 ChatGPT 구독자면 Codex, Claude 구독자면 Claude Code.

---

## 7. 알려진 한계

| 항목 | 내용 |
|---|---|
| 운영체제 | **macOS** 만 검증. Linux 도 거의 OK. **Windows 는 미지원** |
| `.app` 코드 사인 | 아직 미서명 → 첫 실행 시 macOS Gatekeeper 경고. 우클릭→열기 한 번 필요 |
| 이미지 묶음 (PNG) 내보내기 | 일시 비활성 — slides-grab upstream 의 packaging 이슈. PDF/PPTX/Figma 만 지원 |
| 베타 표시된 내보내기 | PPTX / Figma Slides 는 디자인에 따라 글자/위치가 어긋날 수 있어요. **발표용으로는 PDF 권장** |
| 한 번에 1개 deck | 같은 deck 의 "내보내기" 와 "전체 수정" 을 동시에 하면 막아요 |
| 카드 뉴스 (정사각형 인스타용) | 1차 범위 밖. 현재는 16:9 발표 슬라이드만 |

---

## 8. 막힐 때 / 피드백

- 이 GitHub repo 의 **Issues** 탭에 글 남기기
- 함께 알려주시면 좋아요:
  - macOS 버전 (Apple → 이 Mac 에 관하여)
  - 어떤 화면에서 막혔는지
  - 터미널 창에 빨간 글씨 있으면 그 내용

---

## 9. 개발자용 안내

자세한 구조 / 작업 단위는 [`docs/STATUS.md`](docs/STATUS.md), [`CLAUDE.md`](CLAUDE.md), [`docs/PROJECT.md`](docs/PROJECT.md).

```bash
pnpm bootstrap   # 첫 설치 (의존성 + Chromium) — start.command 가 자동으로 함
pnpm dev         # 개발 서버 (HMR)
pnpm build       # 프로덕션 빌드
pnpm typecheck   # tsc --noEmit
pnpm lint        # ESLint
```

폴더 요약:

```
app/                                # Next.js App Router. 4 화면 + API
components/                         # ExportModal, QuickExport, ScaledSlideFrame, TopNav
lib/
├── db/                             # SQLite + 마이그레이션 + 쿼리
├── decks/                          # generator / editor / bulk-edit / export
├── providers/                      # claude-code / codex 추상화 + skill / 본체 자동 설치
└── slides-grab/                    # slides-grab CLI 어댑터
docs/
├── PROJECT.md                      # PRD 압축 + 1차 범위
├── STATUS.md                       # 현재 진행 상태 / 변경 로그
└── mockups/                        # 정적 HTML 디자인 기준
start.command                       # bash launcher (Node.js/pnpm 자동 부트스트랩 + pnpm dev)
Slides-Grab Studio.app/             # macOS .app bundle — Terminal 에서 start.command 호출
samples/            # 예시 brief.md (첫 사용자용)
patches/            # slides-grab contentEditable patch
start.command       # 더블클릭 런처 (macOS)
```

---

## 라이선스 / 기반

- 본 앱: 미정 (개인 프로젝트)
- 기반: [`slides-grab`](https://github.com/vkehfdl1/slides-grab) (MIT)
