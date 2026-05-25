import type { ArchetypeKey, BrandKit } from "./types";

// v2-minimal archetype 카탈로그 — 표지·본문 2종 × 2 옵션 = 4.
// 옵션 추가 (v2b) 시 같은 모듈에 데이터만 추가하면 됨.
// 각 옵션의 render() 는 빌더 썸네일(iframe srcDoc)과 AI prompt 박는 데 같이 사용.

export type SampleContent = {
  title?: string;
  subtitle?: string;
  body?: string;
  bullets?: string[];
  meta?: string;
};

export type ArchetypeOption = {
  id: string; // "A" / "B"
  name: string; // "단정한 좌측"
  description: string; // 사용자 친화 한 줄
  render: (brand: BrandKit, sample: SampleContent) => string;
};

export type ArchetypeMeta = {
  key: ArchetypeKey;
  label: string;
  description: string;
  icon: string;
  options: ArchetypeOption[];
};

const fontStack = (font: string) =>
  `'${font}', -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Pretendard", sans-serif`;

// 빌더 썸네일 안 로고는 placeholder ("BR"). 실제 deck 생성 시엔 generator 의
// instruction 이 brand.logoPath 의 절대 경로로 <img> 박으라고 AI 에 명시.
const logoPlaceholder = (brand: BrandKit, sizePx: number) =>
  `<span style="display:inline-flex;align-items:center;justify-content:center;width:${sizePx}px;height:${sizePx}px;background:${brand.primaryColor};color:${brand.accentColor};border-radius:6px;font-weight:800;font-size:${Math.round(sizePx * 0.4)}px;flex-shrink:0">BR</span>`;

// ─── 표지 ───
export const COVER_A: ArchetypeOption = {
  id: "A",
  name: "단정한 좌측",
  description: "좌측 정렬 큰 제목 + 강조 rule line",
  render: (brand, s) => `<!doctype html>
<html><head><meta charset="utf-8">
<style>
  *,*::before,*::after { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:100%; height:100%; }
  body { font-family: ${fontStack(brand.fontFamily)}; background:#fff; color:${brand.primaryColor};
    padding: 48px 60px; display:flex; flex-direction:column; justify-content:center; gap:14px; }
  .top { display:flex; align-items:center; gap:12px; }
  .eb { font-size:13px; letter-spacing:0.16em; text-transform:uppercase; font-weight:700; opacity:0.7; }
  h1 { font-size:48px; line-height:1.12; letter-spacing:-0.02em; font-weight:800; }
  .rule { width:72px; height:5px; background:${brand.accentColor}; margin-top:8px; }
  .sub { font-size:15px; opacity:0.65; margin-top:10px; }
</style></head><body>
  <div class="top">${logoPlaceholder(brand, 44)}<span class="eb">${escapeHtml(s.meta ?? "2026 H1 · 내부 공유")}</span></div>
  <h1>${s.title ?? "발표 제목"}</h1>
  <div class="rule"></div>
  <div class="sub">${escapeHtml(s.subtitle ?? "부제 또는 발표자")}</div>
</body></html>`,
};

export const COVER_B: ArchetypeOption = {
  id: "B",
  name: "풀 컬러 강조",
  description: "주 색상 배경 + 강조색 키워드",
  render: (brand, s) => `<!doctype html>
<html><head><meta charset="utf-8">
<style>
  *,*::before,*::after { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:100%; height:100%; }
  body { font-family: ${fontStack(brand.fontFamily)}; background:${brand.primaryColor}; color:#fff;
    padding: 48px 60px; display:flex; flex-direction:column; justify-content:space-between; }
  .top { display:flex; align-items:center; gap:12px; }
  h1 { font-size:54px; line-height:1.08; letter-spacing:-0.02em; font-weight:800; }
  h1 .acc { color:${brand.accentColor}; }
  .sub { font-size:14px; opacity:0.8; }
</style></head><body>
  <div class="top">${logoPlaceholder(brand, 36)}</div>
  <div>
    <h1><span class="acc">${escapeHtml(s.meta ?? "2026")}</span> ${escapeHtml(s.title ?? "Vision")}</h1>
  </div>
  <div class="sub">${escapeHtml(s.subtitle ?? "사내 전체 공유")}</div>
</body></html>`,
};

// ─── 본문 ───
export const BODY_A: ArchetypeOption = {
  id: "A",
  name: "좌 헤딩 + 우 본문",
  description: "좌측 큰 헤딩 카드 + 우측 단락",
  render: (brand, s) => `<!doctype html>
<html><head><meta charset="utf-8">
<style>
  *,*::before,*::after { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:100%; height:100%; }
  body { font-family: ${fontStack(brand.fontFamily)}; background:#fff; color:${brand.primaryColor};
    display:flex; align-items:stretch; }
  .L { width:40%; padding:40px; background:#f8fafc; display:flex; flex-direction:column; justify-content:center; gap:8px; }
  .eb { font-size:12px; letter-spacing:0.16em; color:${brand.accentColor}; font-weight:700; text-transform:uppercase; }
  h1 { font-size:32px; line-height:1.15; letter-spacing:-0.015em; font-weight:800; }
  .R { flex:1; padding:40px; display:flex; flex-direction:column; justify-content:center; gap:10px; color:#1f2937; font-size:14px; line-height:1.6; }
  .R p:first-child { font-weight:600; color:${brand.primaryColor}; }
</style></head><body>
  <div class="L">
    <div class="eb">${escapeHtml(s.meta ?? "SECTION 01")}</div>
    <h1>${s.title ?? "핵심 주제"}</h1>
  </div>
  <div class="R">
    <p>${escapeHtml(s.body ?? "발표의 중심 메시지 또는 핵심 주장")}</p>
    <p>${escapeHtml(s.subtitle ?? "이를 뒷받침하는 근거나 데이터를 한 문단 분량으로 풀어 설명합니다.")}</p>
  </div>
</body></html>`,
};

export const BODY_B: ArchetypeOption = {
  id: "B",
  name: "불릿 위주",
  description: "헤딩 + 강조색 불릿 리스트",
  render: (brand, s) => {
    const bullets = (s.bullets ?? [
      "핵심 포인트 1 — 한 줄로",
      "핵심 포인트 2 — 가장 중요",
      "핵심 포인트 3 — 한 줄로",
    ])
      .map(
        (b) =>
          `<li style="display:flex;gap:10px;align-items:flex-start;font-size:15px;line-height:1.6;color:#1f2937"><span style="color:${brand.accentColor};font-weight:800;flex-shrink:0">•</span><span>${escapeHtml(b)}</span></li>`,
      )
      .join("");
    return `<!doctype html>
<html><head><meta charset="utf-8">
<style>
  *,*::before,*::after { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:100%; height:100%; }
  body { font-family: ${fontStack(brand.fontFamily)}; background:#fff; color:${brand.primaryColor};
    padding: 48px 60px; display:flex; flex-direction:column; justify-content:center; gap:16px; }
  .eb { font-size:12px; letter-spacing:0.16em; color:${brand.accentColor}; font-weight:700; text-transform:uppercase; }
  h1 { font-size:32px; line-height:1.15; letter-spacing:-0.015em; font-weight:800; margin-bottom:8px; }
  ul { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:10px; }
</style></head><body>
  <div class="eb">${escapeHtml(s.meta ?? "KEY POINTS")}</div>
  <h1>${s.title ?? "우선 추진할 과제"}</h1>
  <ul>${bullets}</ul>
</body></html>`;
  },
};

export const ARCHETYPES: ArchetypeMeta[] = [
  {
    key: "cover",
    label: "표지",
    description: "발표 자료 맨 앞장. 큰 제목 + 부제 + 로고.",
    icon: "📄",
    options: [COVER_A, COVER_B],
  },
  {
    key: "body",
    label: "본문 (글 위주)",
    description: "가장 많이 쓰는 일반 내용 슬라이드.",
    icon: "📝",
    options: [BODY_A, BODY_B],
  },
];

export function getArchetypeOption(
  key: ArchetypeKey,
  id: string | null,
): ArchetypeOption | null {
  if (!id) return null;
  const meta = ARCHETYPES.find((a) => a.key === key);
  return meta?.options.find((o) => o.id === id) ?? null;
}

function escapeHtml(s: string): string {
  return s.replace(/[<>"'&]/g, (c) => {
    if (c === "<") return "&lt;";
    if (c === ">") return "&gt;";
    if (c === '"') return "&quot;";
    if (c === "'") return "&#39;";
    return "&amp;";
  });
}
