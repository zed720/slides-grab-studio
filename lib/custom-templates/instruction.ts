import type { BrandKit } from "./types";

// 사용자 brand kit → AI 가 따라야 할 디자인 instruction text.
// BITREE_DESIGN_INSTRUCTIONS 패턴과 동일하게 generator prompt 에 박힘.
// v1 은 brand kit (색/폰트/로고) 만 — archetype 별 구체 layout 은 v2.
export function brandKitToInstruction(opts: {
  brand: BrandKit;
  templateName: string;
  logoAbsolutePath: string | null;
}): string {
  const { brand, templateName, logoAbsolutePath } = opts;

  const logoBlock = logoAbsolutePath
    ? `\n* **로고**: \`${logoAbsolutePath}\` 파일을 \`<img src="...">\` 로 표지 슬라이드와 헤더/푸터에 삽입. 절대 경로 그대로 src 에 박으세요. 가로/세로 32~48px 권장 (표지에서는 48~64px).`
    : "\n* **로고**: 사용자가 로고를 등록하지 않았으니 빈 영역으로 두거나 회사 이름 텍스트로 대체.";

  return `
**디자인 — ${templateName} (사용자 양식)**: 아래 spec 을 모든 슬라이드에 일관 적용. slides-grab 의 style id 없이 이 instruction 만 따르세요.

## 색
* **주 색상 \`${brand.primaryColor}\`** — 제목, 헤딩, 강조 텍스트, 핵심 도형
* **강조 색상 \`${brand.accentColor}\`** — 포인트, badge, rule line, callout 배경
* 본문 텍스트는 주 색상의 어두운 계열 또는 \`#1f2937\` 권장
* 배경은 흰색 또는 \`#fafafa\` (라이트 캔버스)

## 타이포
* **${brand.fontFamily}** 단일 패밀리. 다른 폰트 섞지 마세요.
* 디스플레이 Bold(700~800) / 본문 Regular(400)
* 디스플레이 음수 자간 \`-0.5px ~ -1.5px\`
${logoBlock}

## 슬라이드 구조
* 모든 슬라이드 16:9 표준 (\`720pt × 405pt\` 또는 \`1280 × 720\`)
* **표지 슬라이드**: 큰 제목 (주 색상) + 부제, 강조 색상으로 짧은 rule line (가로 60~80px, 두께 3~4px). 로고가 있으면 좌상단 또는 우상단에.
* **본문 슬라이드**: 헤딩(주 색상) + 본문(어두운 회색). 핵심 키워드 강조 시 강조 색상.
* **표/리스트**: 헤더 배경 = 주 색상 + 흰 글자. 강조 셀 = 강조 색상.
* 모든 슬라이드 하단에 작은 footer 권장 (양식 이름 또는 발표 제목 · 페이지 번호).

## 그림자/효과
* 사용 최소화. depth 는 대비와 강조 색상으로만.
`.trim();
}
