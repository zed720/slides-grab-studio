// 우리 앱이 자체 제공하는 커스텀 디자인 — "비트리".
// slides-grab 의 35종 외에 화면 3 에 추가 옵션.
// generator 의 prompt 가 template_id === "bitree" 이면 style id 대신
// 아래 BITREE_DESIGN_INSTRUCTIONS 를 그대로 박음 (AI 가 룰대로 디자인).

import type { Template } from "./templates";

export const BITREE_TEMPLATE_ID = "bitree";

export const BITREE_TEMPLATE: Template = {
  id: BITREE_TEMPLATE_ID,
  name: "Bitree",
  description: "비트리 · 라이트 캔버스 · 그린 포인트 · 좌 annotation",
  previewHtml: buildPreviewHtml(),
};

function buildPreviewHtml(): string {
  // 워너비 구조: 좌측 그린 사이드라인 + 상단 섹션 라벨 + 캡션바 + 본문 + 하단 콜아웃 + 푸터.
  return `<!doctype html>
<html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
<style>
  *,*::before,*::after { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:100%; height:100%; }
  body {
    width: 960px; height: 540px;
    background: #f4f4f4;
    font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif;
    color: #003D27;
    position: relative;
    padding: 28px 36px 24px 44px;
    display: flex; flex-direction: column;
  }
  /* 좌측 세로 그린 사이드라인 */
  body::before {
    content: ""; position: absolute; left: 0; top: 0; bottom: 0;
    width: 6px; background: #00EC97;
  }
  /* 상단 라벨 줄 */
  .top {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 12px;
  }
  .section-chip {
    background: #003D27; color: #fff; padding: 3px 10px;
    font-size: 11px; font-weight: 700; letter-spacing: 0.04em;
  }
  .section-label {
    font-size: 12px; font-weight: 500; color: #003D27;
    opacity: 0.7;
  }
  .page-no { font-size: 12px; color: #003D27; opacity: 0.55; font-weight: 600; }
  /* 캡션바 */
  .caption {
    padding: 9px 14px;
    background: #EBFFF8;
    color: #003D27;
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 16px;
  }
  .caption b { font-weight: 700; }
  /* 본문 영역 */
  .body { flex: 1; display: flex; flex-direction: column; gap: 14px; min-height: 0; }
  .body h1 {
    font-size: 30px; font-weight: 800; letter-spacing: -0.6px; line-height: 1.15;
    color: #003D27;
  }
  .body h1 .accent { color: #00EC97; }
  .body .sub { font-size: 13px; color: #003D27; opacity: 0.75; line-height: 1.5; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 4px; }
  .card {
    background: #fff; border-radius: 12px; padding: 14px 16px;
    display: flex; flex-direction: column; gap: 8px;
  }
  .card .badge {
    display: inline-block; background: #00EC97; color: #003D27;
    padding: 2px 8px; font-size: 10px; font-weight: 800;
    margin-right: 4px;
  }
  .card .title { font-size: 13px; font-weight: 800; }
  .card ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 3px; }
  .card li { font-size: 11px; color: #003D27; line-height: 1.4; }
  .card li b { font-weight: 700; opacity: 0.6; margin-right: 6px; }
  /* 하단 CORE FRAMING 콜아웃 */
  .callout {
    background: #003D27; color: #fff;
    padding: 8px 14px; font-size: 11px;
    display: flex; align-items: center; gap: 12px;
  }
  .callout .tag { color: #00EC97; font-weight: 800; letter-spacing: 0.05em; font-size: 10px; }
  /* 푸터 */
  .footer {
    display: flex; justify-content: space-between;
    font-size: 10px; color: #003D27; opacity: 0.6; font-weight: 500;
    margin-top: 6px;
  }
</style></head>
<body>
  <div class="top">
    <div style="display:flex;align-items:center;gap:8px">
      <span class="section-chip">A 01</span>
      <span class="section-label">디자인 · 비트리 견본</span>
    </div>
    <span class="page-no">01 / 36</span>
  </div>
  <div class="caption"><b>이 장표가 답하는 질문</b> &nbsp; 비트리 디자인은 어떻게 보이는가?</div>
  <div class="body">
    <h1>라이트 캔버스 · <span class="accent">그린</span> 포인트로<br/>구조와 호흡을 만듭니다</h1>
    <div class="sub">상단 캡션바 + 좌측 그린 사이드라인 + 콘텐츠에 맞춘 유연한 레이아웃.</div>
    <div class="two-col">
      <div class="card">
        <div><span class="badge">Q</span><span class="title">색</span></div>
        <ul>
          <li><b>01</b>Bitree Green — 핵심 강조</li>
          <li><b>02</b>Deep Green — 본문 텍스트</li>
          <li><b>03</b>Mint Fog — 캡션바 배경</li>
        </ul>
      </div>
      <div class="card">
        <div><span class="badge">A</span><span class="title">구조</span></div>
        <ul>
          <li><b>01</b>상단 캡션바 — 답하는 질문</li>
          <li><b>02</b>한 장표 한 도식</li>
          <li><b>03</b>하단 콜아웃 — 핵심 한 줄</li>
        </ul>
      </div>
    </div>
  </div>
  <div class="callout"><span class="tag">CORE FRAMING</span><span>비트리 디자인은 '도식'이 아니라 '구조적 명확성'에 무게를 둡니다</span></div>
  <div class="footer">
    <span>BiTree Corporation · Slide Studio</span>
    <span>v1 — 2026.05</span>
  </div>
</body></html>`;
}

// AI 가 design 단계에서 따라야 할 비트리 디자인 spec — generator prompt 에 박힘.
export const BITREE_DESIGN_INSTRUCTIONS = `
**디자인 — Bitree (커스텀)**: 아래 spec 을 모든 슬라이드에 일관 적용. style id 없이 이 instruction 만 따르세요.

## 캔버스
* 사이즈: \`720pt × 405pt\` (16:9, slides-grab 표준)
* 본문 배경: \`#f4f4f4\` (canvas-light)
* 카드 배경: \`#ffffff\` (canvas-white)
* 다크 캔버스 사용 안 함 — 모든 슬라이드 라이트 캔버스 통일 (인쇄 최적화)

## 컬러
* **Bitree Green \`#00EC97\`** — primary 강조, 사이드라인, badge
* **Deep Green \`#003D27\`** — 본문 텍스트, 어두운 콜아웃 배경
* **Mint Fog \`#EBFFF8\`** — 캡션바 배경 (soft highlight)
* **Sempio Yellow \`#F4C430\`** — 예외 강조. "샘표 자체 담당" 영역 / FDE 강조 / 핵심 비용 / 걱정 해소 마커에만.

## 타이포
* Pretendard 또는 Wanted Sans 단일 패밀리.
* Extra Bold(800) 디스플레이 / Bold(700) 서브헤드 / Regular(400) 본문
* 디스플레이 음수 자간 \`-0.5pt ~ -2pt\`

## 슬라이드 구조 (모든 슬라이드 공통)
\`\`\`
┌──┬───────────────────────────────────────┐
│  │ [섹션 칩] 섹션 라벨           02 / N  │  ← 상단: 좌측 칩 + 우상단 페이지
│그│ ┌───────────────────────────────────┐ │
│린│ │ Q. 이 장표가 답하는 질문 (한 줄)  │ │  ← 캡션바 (Mint Fog 배경)
│사│ └───────────────────────────────────┘ │
│이│                                       │
│드│  [본문 — 콘텐츠 따라 유연하게]        │  ← 본문 (자유 레이아웃)
│라│                                       │
│인│ ┌───────────────────────────────────┐ │
│  │ │ CORE FRAMING  핵심 한 줄          │ │  ← 하단 콜아웃 (필요 시)
│  │ └───────────────────────────────────┘ │
│  │ BiTree Corporation · 제목   v1 — 5월  │  ← 푸터
└──┴───────────────────────────────────────┘
\`\`\`

### 좌측 그린 사이드라인 (필수)
* 슬라이드 좌측 끝에 세로 \`6pt\` 너비의 \`#00EC97\` 막대. 슬라이드 전체 높이.
* 모든 슬라이드 동일하게.

### 상단 영역 (필수)
* 좌측: 섹션 칩 (Deep Green 배경 + 흰 글자, 8pt × 3pt padding, 폰트 11pt/800) + 옆에 회색 섹션 라벨
* 우측: 페이지 번호 \`02 / N\` (11pt, Deep Green opacity 0.55, weight 600)

### 캡션바 (필수)
* 매 슬라이드 상단에. Mint Fog 배경 + Deep Green 텍스트.
* 형식: **이 장표가 답하는 질문** (굵게) + 한 줄 설명
* font-size 12pt / weight 600, padding 9pt × 14pt.

### 본문 (콘텐츠에 맞춰 유연하게)
* 26/74 split 강제 X — 슬라이드 콘텐츠 따라 결정:
  - 표지 / 큰 헤딩 → 큰 H1 풀폭 + 부제 + 정보 칩
  - 비교 / Q&A → 2-column 동등 카드
  - 다이어그램 → 가운데 도식 + 좌우 짧은 설명
  - 리스트 → 큰 헤딩 + 번호 매긴 리스트
* **한 장표에 핵심 도식 1개 원칙** (둘 이상 X)
* 카드 \`border-radius: 12pt\`. 콜아웃 / 컬러 블록 \`border-radius: 0\` (샤프)

### 하단 콜아웃 — CORE FRAMING (옵션)
* 핵심 한 줄 강조할 때만. Deep Green \`#003D27\` 배경 + 흰 글자.
* 형식: **CORE FRAMING** (Bitree Green, weight 800, 10pt) + 본문 한 줄 (흰색, 11pt)
* padding 8pt × 14pt. \`border-radius: 0\`.

### 푸터 (필수)
* 좌하단: \`BiTree Corporation · <발표 제목>\` (10pt, Deep Green opacity 0.6, weight 500)
* 우하단: 버전 또는 페이지 번호 보조 (예: \`v1 — 2026.05\`)

## 그림자
* 사용 안 함. depth 는 대비 + Bitree Green 강조로만.
`;
