import type { ArchetypeKey, BrandKit } from "./types";
import { getArchetypeOption } from "./archetypes";

// 사용자 brand kit → AI 가 따라야 할 디자인 instruction text.
// BITREE_DESIGN_INSTRUCTIONS 패턴과 동일하게 generator prompt 에 박힘.
// v1: brand kit (색/폰트/로고) — 모든 슬라이드 공통 spec.
// v2: archetype 골라져 있으면 그 옵션의 sample HTML 도 prompt 에 박음 — AI 가
//     새 콘텐츠로 같은 layout 만듦 (BITREE 와 같은 식의 strong anchor).
export function brandKitToInstruction(opts: {
  brand: BrandKit;
  templateName: string;
  logoAbsolutePath: string | null;
}): string {
  const { brand, templateName, logoAbsolutePath } = opts;
  const archetypes = brand.archetypes ?? {};

  const logoBlock = logoAbsolutePath
    ? `\n* **로고**: \`${logoAbsolutePath}\` 파일을 \`<img src="...">\` 로 표지 슬라이드와 헤더/푸터에 삽입. 절대 경로 그대로 src 에 박으세요. 가로/세로 32~48px 권장 (표지에서는 48~64px).`
    : "\n* **로고**: 사용자가 로고를 등록하지 않았으니 빈 영역으로 두거나 회사 이름 텍스트로 대체.";

  // archetype 별 sample layout — 사용자가 갤러리에서 본 그 모양 그대로 AI 에 보여줌.
  const archetypeBlocks: string[] = [];
  const archLabels: Record<ArchetypeKey, string> = {
    cover: "표지 슬라이드",
    toc: "목차 슬라이드",
    body: "본문 슬라이드 (글 위주)",
    table: "표 슬라이드",
    chart: "차트 슬라이드",
    image: "이미지 강조 슬라이드",
    closing: "마무리 슬라이드",
  };
  const ARCH_KEYS: ArchetypeKey[] = [
    "cover",
    "toc",
    "body",
    "table",
    "chart",
    "image",
    "closing",
  ];
  for (const key of ARCH_KEYS) {
    const choice = archetypes[key];
    if (!choice) continue;
    const opt = getArchetypeOption(key, choice);
    if (!opt) continue;
    const sample = opt.render(brand, {});
    archetypeBlocks.push(
      `\n### ${archLabels[key]} — 사용자가 고른 모양: ${opt.id} (${opt.name})\n${opt.description}.\n\n**새 발표 자료의 ${archLabels[key]}는 아래 HTML 의 구조·레이아웃·시각 비례를 그대로 따르세요. 색·폰트는 위 brand spec 이 이미 적용된 상태이고, 텍스트만 발표 콘텐츠로 교체하세요. 로고 부분의 \`<span>BR</span>\` placeholder 는 사용자 로고 파일의 \`<img>\` 로 교체.**\n\n\`\`\`html\n${sample}\n\`\`\``,
    );
  }
  const archetypeSection =
    archetypeBlocks.length > 0
      ? `\n\n## 슬라이드 종류별 레이아웃 (사용자 픽)${archetypeBlocks.join("")}\n\n위에서 명시되지 않은 슬라이드 종류 (목차/표/차트/이미지/마무리 등) 는 위 brand spec 만 적용하고 적절한 일반 layout 사용.`
      : "";

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

## 슬라이드 구조 (기본)
* 모든 슬라이드 16:9 표준 (\`720pt × 405pt\` 또는 \`1280 × 720\`)
* **표지 슬라이드**: 큰 제목 (주 색상) + 부제, 강조 색상으로 짧은 rule line (가로 60~80px, 두께 3~4px). 로고가 있으면 좌상단 또는 우상단에.
* **본문 슬라이드**: 헤딩(주 색상) + 본문(어두운 회색). 핵심 키워드 강조 시 강조 색상.
* **표/리스트**: 헤더 배경 = 주 색상 + 흰 글자. 강조 셀 = 강조 색상.
* 모든 슬라이드 하단에 작은 footer 권장 (양식 이름 또는 발표 제목 · 페이지 번호).

## 그림자/효과
* 사용 최소화. depth 는 대비와 강조 색상으로만.${archetypeSection}
`.trim();
}
