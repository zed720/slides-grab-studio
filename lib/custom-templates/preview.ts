import type { BrandKit } from "./types";

// 빌더 미리보기용 — 사용자 brand kit 으로 sample slide HTML 한 장.
// 실제 deck 생성과는 별개. UI 가 iframe srcDoc / src 로 띄움.
export function buildPreviewHtml(opts: {
  brand: BrandKit;
  logoUrl: string | null;
  sampleTitle?: string;
}): string {
  const { brand, logoUrl } = opts;
  const title = opts.sampleTitle ?? "2026년 상반기<br/>사업 계획";

  const safeFont = brand.fontFamily.replace(/[<>"']/g, "");
  const safePrimary = sanitizeHex(brand.primaryColor) ?? "#003C71";
  const safeAccent = sanitizeHex(brand.accentColor) ?? "#FFB81C";

  return `<!doctype html>
<html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
<style>
  *,*::before,*::after { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:100%; height:100%; }
  body {
    font-family: '${safeFont}', -apple-system, BlinkMacSystemFont, sans-serif;
    background: #fff;
    color: ${safePrimary};
    padding: 36px 48px;
    display: flex; flex-direction: column; justify-content: center;
    gap: 14px;
  }
  .top { display: flex; align-items: center; gap: 12px; }
  .logo {
    width: 44px; height: 44px;
    border-radius: 8px;
    background: ${safePrimary};
    color: ${safeAccent};
    display: inline-flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: 18px;
    overflow: hidden;
    flex-shrink: 0;
  }
  .logo img { width: 100%; height: 100%; object-fit: contain; padding: 4px; background: #fff; }
  .eb {
    font-size: 11px; letter-spacing: 0.16em; color: ${safePrimary};
    text-transform: uppercase; font-weight: 700; opacity: 0.7;
  }
  h1 {
    font-size: 38px; line-height: 1.15; letter-spacing: -0.018em;
    font-weight: 800; color: ${safePrimary};
    margin: 4px 0;
  }
  .rule { width: 60px; height: 4px; background: ${safeAccent}; margin-top: 6px; }
  .sub { font-size: 14px; opacity: 0.65; margin-top: 8px; display: flex; align-items: center; gap: 8px; }
  .badge {
    display: inline-block; padding: 4px 10px;
    background: ${safeAccent}; color: ${safePrimary};
    font-size: 11px; font-weight: 700; border-radius: 4px;
  }
</style></head>
<body>
  <div class="top">
    <span class="logo">${
      logoUrl
        ? `<img src="${escapeAttr(logoUrl)}" alt="로고"/>`
        : `BR`
    }</span>
    <span class="eb">2026 H1 · 내부 공유</span>
  </div>
  <h1>${title}</h1>
  <div class="rule"></div>
  <div class="sub">전략기획팀 · 2026.05 <span class="badge">미리보기</span></div>
</body></html>`;
}

function sanitizeHex(s: string): string | null {
  if (!/^#[0-9a-fA-F]{6}$/.test(s)) return null;
  return s.toUpperCase();
}

function escapeAttr(s: string): string {
  return s.replace(/[<>"']/g, (c) => {
    if (c === "<") return "&lt;";
    if (c === ">") return "&gt;";
    if (c === '"') return "&quot;";
    return "&#39;";
  });
}
