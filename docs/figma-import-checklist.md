# Figma Slides Import 검증 체크리스트

> graceful skip 패치 후 figma export 가 동작하는지 / 결과물이 쓸 만한지 확인할 때 사용.

## 흐름

1. 우리 앱 화면 4 → `⬇ 내보내기 → Figma Slides 용 → 만들기 시작`
2. `<제목>-figma.pptx` 다운로드
3. [figma.com/slides](https://www.figma.com/slides/) 로그인 → 새 Slides 파일
4. 상단 메뉴 → **Import** → 받은 `.pptx` 선택

## 체크 항목

### 필수 (✓ 면 export 자체는 성공)
- [ ] 모든 슬라이드 (1~N) 가 Figma 에 모두 import 됐는지
- [ ] 각 슬라이드의 **제목 / 본문 텍스트** 가 보존됐는지 (글자 누락 X)
- [ ] 슬라이드 간 순서가 맞는지

### 디자인 보존 (graceful skip 로 일부 누락 정상)
- [ ] 텍스트의 **색깔 / 굵기** 가 그대로인지
- [ ] 슬라이드 **배경색** 이 그대로인지 (gradient 는 누락 가능)
- [ ] 표/리스트의 **레이아웃** 이 어긋나지 않는지
- [ ] 페이지 번호 / footer 같은 공통 요소가 그대로인지

### 알려진 누락 (정상 — 우리 patch 가 graceful 로 처리)
- [x] `<div>` 의 `background-image` (gradient / 패턴) 가 누락될 수 있음
- [x] `<p>` 의 `border` 가 누락될 수 있음
- [x] `<span>` 등 inline element 의 `margin-left/right` 가 누락될 수 있음
- → 어떤 게 누락됐는지 터미널 창에 console.warn 으로 안내됨

## 결과 판정

| 케이스 | 판정 |
|---|---|
| 텍스트 100% 보존 + 레이아웃 80%+ 유지 | ✅ graceful patch 성공 |
| 텍스트 일부 누락 (예: 슬라이드 1장만 빈 페이지) | ⚠️ 추가 patch 필요 — 어느 slide 인지 알려주세요 |
| Figma 자체가 import 거부 / 에러 | ❌ 더 깊은 fix 필요 — Figma 의 에러 메시지 캡처 |

## 그 외

- **PDF 결과물과 비교** — PDF 가 가장 정확한 시각. Figma 결과가 PDF 의 80%+ 보존이면 합격.
- **MS PowerPoint 와 비교** — 일반 PPTX (`Figma 용` 이 아닌) 옵션과 차이를 보고 싶으면 둘 다 export 후 PowerPoint 와 Figma 에 각각 import.
