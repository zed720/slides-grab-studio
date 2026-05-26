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

// ─── 목차 ───
export const TOC_A: ArchetypeOption = {
  id: "A",
  name: "번호 + 줄",
  description: "세로 리스트 + 강조색 번호",
  render: (brand, s) => {
    const items = (s.bullets ?? [
      "사업 현황",
      "주요 성과",
      "향후 계획",
      "마무리",
    ])
      .map(
        (b, i) =>
          `<li style="display:flex;gap:14px;font-size:18px;line-height:1.6;color:${brand.primaryColor};padding:8px 0;border-bottom:1px solid #e5e7eb"><span style="color:${brand.accentColor};font-weight:800;min-width:32px">${String(i + 1).padStart(2, "0")}</span><span>${escapeHtml(b)}</span></li>`,
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
  h1 { font-size:36px; font-weight:800; letter-spacing:-0.015em; }
  ul { list-style:none; padding:0; margin:0; }
</style></head><body>
  <div class="eb">${escapeHtml(s.meta ?? "CONTENTS")}</div>
  <h1>${escapeHtml(s.title ?? "목차")}</h1>
  <ul>${items}</ul>
</body></html>`;
  },
};

export const TOC_B: ArchetypeOption = {
  id: "B",
  name: "사이드 강조",
  description: "좌측 주색 패널 + 우측 항목 리스트",
  render: (brand, s) => {
    const items = (s.bullets ?? [
      "사업 현황",
      "주요 성과",
      "향후 계획",
      "마무리",
    ])
      .map(
        (b, i) =>
          `<li style="display:flex;gap:12px;font-size:16px;line-height:1.8;color:${brand.primaryColor};padding:6px 0;border-bottom:1px solid #e5e7eb"><span style="color:${brand.accentColor};font-weight:800;min-width:28px">${String(i + 1).padStart(2, "0")}</span><span>${escapeHtml(b)}</span></li>`,
      )
      .join("");
    return `<!doctype html>
<html><head><meta charset="utf-8">
<style>
  *,*::before,*::after { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:100%; height:100%; }
  body { font-family: ${fontStack(brand.fontFamily)}; background:#fff; display:flex; align-items:stretch; }
  .L { width:38%; background:${brand.primaryColor}; color:#fff; padding:40px; display:flex; flex-direction:column; justify-content:center; gap:8px; }
  .L .eb { font-size:12px; letter-spacing:0.16em; color:${brand.accentColor}; font-weight:700; text-transform:uppercase; }
  .L h1 { font-size:36px; font-weight:800; letter-spacing:-0.015em; line-height:1.15; }
  .R { flex:1; padding:40px; display:flex; flex-direction:column; justify-content:center; }
  ul { list-style:none; padding:0; margin:0; }
</style></head><body>
  <div class="L">
    <div class="eb">${escapeHtml(s.meta ?? "CONTENTS")}</div>
    <h1>${escapeHtml(s.title ?? "오늘<br/>다룰 내용")}</h1>
  </div>
  <div class="R"><ul>${items}</ul></div>
</body></html>`;
  },
};

// ─── 표 ───
export const TABLE_A: ArchetypeOption = {
  id: "A",
  name: "일반 표",
  description: "주색 헤더 + zebra 행 + 강조열",
  render: (brand, s) => `<!doctype html>
<html><head><meta charset="utf-8">
<style>
  *,*::before,*::after { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:100%; height:100%; }
  body { font-family: ${fontStack(brand.fontFamily)}; background:#fff; color:${brand.primaryColor};
    padding: 48px 60px; display:flex; flex-direction:column; justify-content:center; gap:16px; }
  .eb { font-size:12px; letter-spacing:0.16em; color:${brand.accentColor}; font-weight:700; text-transform:uppercase; }
  h1 { font-size:32px; font-weight:800; letter-spacing:-0.015em; margin-bottom:8px; }
  table { width:100%; border-collapse:collapse; font-size:15px; }
  th { background:${brand.primaryColor}; color:#fff; padding:10px 14px; text-align:left; font-weight:700; }
  td { padding:9px 14px; border-bottom:1px solid #e5e7eb; color:#1f2937; }
  tr:nth-child(even) td { background:#f8fafc; }
  td:last-child { color:${brand.accentColor}; font-weight:700; text-align:right; }
</style></head><body>
  <div class="eb">${escapeHtml(s.meta ?? "DATA")}</div>
  <h1>${escapeHtml(s.title ?? "분기별 매출")}</h1>
  <table>
    <thead><tr><th>분기</th><th>제품</th><th>매출</th></tr></thead>
    <tbody>
      <tr><td>Q1</td><td>A 라인</td><td>2.4억</td></tr>
      <tr><td>Q2</td><td>A 라인</td><td>3.1억</td></tr>
      <tr><td>Q3</td><td>B 라인</td><td>4.6억</td></tr>
      <tr><td>Q4</td><td>B 라인</td><td>6.2억</td></tr>
    </tbody>
  </table>
</body></html>`,
};

export const TABLE_B: ArchetypeOption = {
  id: "B",
  name: "카드 형",
  description: "세로 카드 행 + 좌측 강조 bar",
  render: (brand, s) => {
    const rows = [
      ["월 활성 사용자", "전월 대비", "+18%"],
      ["유료 전환율", "전월 대비", "+3.2pp"],
      ["이탈률", "전월 대비", "-1.4pp"],
    ]
      .map(
        ([k, sub, v]) =>
          `<div style="display:grid;grid-template-columns:1fr 1fr 120px;gap:14px;align-items:center;font-size:15px;padding:14px 18px;background:#f8fafc;border-left:4px solid ${brand.accentColor};color:#1f2937"><span style="font-weight:600;color:${brand.primaryColor}">${escapeHtml(k)}</span><span style="opacity:0.65">${escapeHtml(sub)}</span><span style="text-align:right;color:${brand.primaryColor};font-weight:800;font-size:18px">${escapeHtml(v)}</span></div>`,
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
  h1 { font-size:32px; font-weight:800; letter-spacing:-0.015em; margin-bottom:8px; }
  .rows { display:flex; flex-direction:column; gap:8px; }
</style></head><body>
  <div class="eb">${escapeHtml(s.meta ?? "METRICS")}</div>
  <h1>${escapeHtml(s.title ?? "주요 지표")}</h1>
  <div class="rows">${rows}</div>
</body></html>`;
  },
};

// ─── 차트 ───
export const CHART_A: ArchetypeOption = {
  id: "A",
  name: "막대 차트",
  description: "월별 추이 + 마지막 막대 강조",
  render: (brand, s) => {
    const heights = [30, 45, 55, 70, 88];
    const labels = ["1월", "2월", "3월", "4월", "5월"];
    const bars = heights
      .map(
        (h, i) =>
          `<span style="flex:1;background:${i === heights.length - 1 ? brand.primaryColor : `linear-gradient(180deg, ${brand.accentColor}, #f59e0b)`};border-radius:3px;height:${h}%"></span>`,
      )
      .join("");
    const xax = labels
      .map(
        (l) =>
          `<span style="flex:1;text-align:center;font-size:12px;color:#64748b">${escapeHtml(l)}</span>`,
      )
      .join("");
    return `<!doctype html>
<html><head><meta charset="utf-8">
<style>
  *,*::before,*::after { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:100%; height:100%; }
  body { font-family: ${fontStack(brand.fontFamily)}; background:#fff; color:${brand.primaryColor};
    padding: 48px 60px; display:flex; flex-direction:column; justify-content:center; gap:14px; }
  .eb { font-size:12px; letter-spacing:0.16em; color:${brand.accentColor}; font-weight:700; text-transform:uppercase; }
  h1 { font-size:30px; font-weight:800; letter-spacing:-0.015em; margin-bottom:8px; }
  .bars { display:flex; gap:14px; align-items:flex-end; height:180px; padding:0 8px; }
  .xax { display:flex; gap:14px; margin-top:6px; padding:0 8px; }
</style></head><body>
  <div class="eb">${escapeHtml(s.meta ?? "TRENDS")}</div>
  <h1>${escapeHtml(s.title ?? "월별 매출 추이")}</h1>
  <div class="bars">${bars}</div>
  <div class="xax">${xax}</div>
</body></html>`;
  },
};

export const CHART_B: ArchetypeOption = {
  id: "B",
  name: "큰 숫자 강조",
  description: "주색 배경 + 강조색 거대 숫자",
  render: (brand, s) => `<!doctype html>
<html><head><meta charset="utf-8">
<style>
  *,*::before,*::after { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:100%; height:100%; }
  body { font-family: ${fontStack(brand.fontFamily)}; background:${brand.primaryColor}; color:#fff;
    display:flex; flex-direction:column; justify-content:center; align-items:center; gap:8px; text-align:center; }
  .label { font-size:13px; letter-spacing:0.16em; color:${brand.accentColor}; font-weight:700; text-transform:uppercase; }
  .big { font-size:140px; font-weight:900; letter-spacing:-0.04em; color:${brand.accentColor}; line-height:1; }
  .sub { font-size:16px; opacity:0.75; }
</style></head><body>
  <div class="label">${escapeHtml(s.meta ?? "GROWTH")}</div>
  <div class="big">${escapeHtml(s.title ?? "3.4×")}</div>
  <div class="sub">${escapeHtml(s.subtitle ?? "전년 동기 대비")}</div>
</body></html>`,
};

// ─── 이미지 강조 ───
export const IMAGE_A: ArchetypeOption = {
  id: "A",
  name: "좌 사진 + 우 텍스트",
  description: "절반 분할 — 사진 영역 + 본문 카드",
  render: (brand, s) => `<!doctype html>
<html><head><meta charset="utf-8">
<style>
  *,*::before,*::after { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:100%; height:100%; }
  body { font-family: ${fontStack(brand.fontFamily)}; background:#fff; display:flex; align-items:stretch; }
  .L { width:50%; background:linear-gradient(135deg, ${brand.primaryColor}, #1e3a8a); position:relative; }
  .L::after { content:"📷"; position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:64px; opacity:0.4; }
  .R { flex:1; padding:48px; display:flex; flex-direction:column; justify-content:center; gap:10px; }
  .eb { font-size:12px; letter-spacing:0.16em; color:${brand.accentColor}; font-weight:700; text-transform:uppercase; }
  h1 { font-size:30px; font-weight:800; letter-spacing:-0.015em; color:${brand.primaryColor}; line-height:1.2; }
  .tx { font-size:15px; line-height:1.6; color:#1f2937; margin-top:6px; }
</style></head><body>
  <div class="L"></div>
  <div class="R">
    <div class="eb">${escapeHtml(s.meta ?? "CASE 01")}</div>
    <h1>${escapeHtml(s.title ?? "고객 사례")}</h1>
    <p class="tx">${escapeHtml(s.body ?? "신규 기능 도입 후 처리 시간 40% 단축. 운영 인원 재배치도 함께 진행해 비용 절감 효과까지 확인.")}</p>
  </div>
</body></html>`,
};

export const IMAGE_B: ArchetypeOption = {
  id: "B",
  name: "풀 사진 + 오버레이",
  description: "전체 사진 영역 + 어둠 오버레이에 메시지",
  render: (brand, s) => `<!doctype html>
<html><head><meta charset="utf-8">
<style>
  *,*::before,*::after { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:100%; height:100%; }
  body { font-family: ${fontStack(brand.fontFamily)}; background:linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.85)), linear-gradient(135deg, ${brand.primaryColor}, #1e293b);
    color:#fff; padding: 48px 60px; display:flex; flex-direction:column; justify-content:flex-end; position:relative; }
  .logo-slot { position:absolute; top:30px; left:60px; }
  h1 { font-size:48px; font-weight:800; line-height:1.1; letter-spacing:-0.018em; }
  .sub { font-size:16px; opacity:0.8; margin-top:10px; }
</style></head><body>
  <div class="logo-slot">${logoPlaceholder(brand, 36)}</div>
  <h1>${escapeHtml(s.title ?? "우리가 함께한<br/>한 해")}</h1>
  <div class="sub">${escapeHtml(s.subtitle ?? "2026 사내 워크숍 현장")}</div>
</body></html>`,
};

// ─── 마무리 ───
export const CLOSING_A: ArchetypeOption = {
  id: "A",
  name: "한 줄 굵게",
  description: "주색 배경 + 강조색 키워드 강조",
  render: (brand, s) => `<!doctype html>
<html><head><meta charset="utf-8">
<style>
  *,*::before,*::after { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:100%; height:100%; }
  body { font-family: ${fontStack(brand.fontFamily)}; background:${brand.primaryColor}; color:#fff;
    display:flex; flex-direction:column; justify-content:center; align-items:center; gap:12px; text-align:center; padding: 48px 60px; }
  h1 { font-size:72px; font-weight:800; letter-spacing:-0.025em; line-height:1.1; }
  h1 .acc { color:${brand.accentColor}; }
  .sub { font-size:16px; opacity:0.7; margin-top:8px; }
</style></head><body>
  <h1>감사<span class="acc">${escapeHtml(s.title ?? "합니다")}</span></h1>
  <div class="sub">${escapeHtml(s.subtitle ?? "질문 환영합니다 — contact@company.com")}</div>
</body></html>`,
};

export const CLOSING_B: ArchetypeOption = {
  id: "B",
  name: "단정한 메시지",
  description: "흰 배경 + 라벨 + 짧은 메시지",
  render: (brand, s) => `<!doctype html>
<html><head><meta charset="utf-8">
<style>
  *,*::before,*::after { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:100%; height:100%; }
  body { font-family: ${fontStack(brand.fontFamily)}; background:#fff; color:${brand.primaryColor};
    padding: 48px 60px; display:flex; flex-direction:column; justify-content:center; gap:10px; }
  .eb { font-size:13px; letter-spacing:0.2em; color:${brand.accentColor}; font-weight:700; text-transform:uppercase; }
  h1 { font-size:54px; font-weight:800; letter-spacing:-0.02em; line-height:1.1; }
  .rule { width:60px; height:4px; background:${brand.accentColor}; margin:14px 0; }
  .em { font-size:15px; opacity:0.65; }
</style></head><body>
  <div class="eb">${escapeHtml(s.meta ?? "THANK YOU")}</div>
  <h1>${escapeHtml(s.title ?? "함께 더 멀리.")}</h1>
  <div class="rule"></div>
  <div class="em">${escapeHtml(s.subtitle ?? "전략기획팀 · contact@company.com")}</div>
</body></html>`,
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
    key: "toc",
    label: "목차",
    description: "앞에서 발표 구성을 보여주는 슬라이드.",
    icon: "📋",
    options: [TOC_A, TOC_B],
  },
  {
    key: "body",
    label: "본문 (글 위주)",
    description: "가장 많이 쓰는 일반 내용 슬라이드.",
    icon: "📝",
    options: [BODY_A, BODY_B],
  },
  {
    key: "table",
    label: "표 (테이블)",
    description: "숫자·항목 비교에 쓰는 슬라이드.",
    icon: "🔢",
    options: [TABLE_A, TABLE_B],
  },
  {
    key: "chart",
    label: "차트 (그래프)",
    description: "트렌드·비율 시각화에 쓰는 슬라이드.",
    icon: "📊",
    options: [CHART_A, CHART_B],
  },
  {
    key: "image",
    label: "이미지 강조",
    description: "사진·스크린샷이 메인이 되는 슬라이드.",
    icon: "🖼️",
    options: [IMAGE_A, IMAGE_B],
  },
  {
    key: "closing",
    label: "마무리 (감사 / 질문)",
    description: "발표 맨 마지막 장. 감사·Q&A.",
    icon: "🙏",
    options: [CLOSING_A, CLOSING_B],
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

// 통합 lookup — 정적 옵션 + AI 옵션 둘 다 검색. id 는 "A"/"B" 같은 정적 옵션 id
// 또는 "ai-<timestamp>-<rand>" AI 옵션 id. 결과는 html string + 메타.
// `isStatic` 으로 호출자가 분기 (예: preview 의 로고 placeholder 교체).
export type ResolvedArchetype = {
  id: string;
  name: string;
  description: string;
  html: string;
  isStatic: boolean;
};

export function resolveArchetype(
  key: ArchetypeKey,
  id: string | null,
  brand: BrandKit,
): ResolvedArchetype | null {
  if (!id) return null;
  // 정적 옵션 — brand 적용해서 render.
  const staticOpt = getArchetypeOption(key, id);
  if (staticOpt) {
    return {
      id: staticOpt.id,
      name: staticOpt.name,
      description: staticOpt.description,
      html: staticOpt.render(brand, {}),
      isStatic: true,
    };
  }
  // AI 옵션 — brand 적용된 final snapshot 그대로.
  const ai = brand.aiArchetypes?.[key]?.find((e) => e.id === id);
  if (ai) {
    return {
      id: ai.id,
      name: ai.name,
      description: ai.description,
      html: ai.html,
      isStatic: false,
    };
  }
  return null;
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
