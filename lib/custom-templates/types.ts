// 사용자가 등록한 회사 양식.
// v1: brand kit (로고·색·폰트) 만.
// v2: archetypes (슬라이드 종류별 layout 픽) 추가 — 표지·본문 2종부터.
// v3: AI 새 모양 만들기 — 미정.

// v2 — archetype 종류 키. v2b 에서 7 종 다 추가됨.
export type ArchetypeKey =
  | "cover"
  | "toc"
  | "body"
  | "table"
  | "chart"
  | "image"
  | "closing";

// 옵션 id (예: "A", "B") 또는 null = 안 고름 = AI 가 알아서.
export type ArchetypeChoice = string | null;

export type ArchetypeMap = {
  cover?: ArchetypeChoice;
  toc?: ArchetypeChoice;
  body?: ArchetypeChoice;
  table?: ArchetypeChoice;
  chart?: ArchetypeChoice;
  image?: ArchetypeChoice;
  closing?: ArchetypeChoice;
};

// v3 — AI 가 생성한 archetype 옵션. 사용자가 🪄 새 모양 만들기 누르면 spawn.
// 결과 HTML 은 brand 적용된 final string (snapshot — 나중에 brand 색 바꿔도 그대로).
export type AIArchetypeEntry = {
  id: string; // "ai-<timestamp>-<rand>"
  archKey: ArchetypeKey; // 어느 archetype 종류용인지
  name: string; // 사용자에게 보이는 이름 ("내가 5/26 만듦")
  description: string; // 사용자 prompt 한 줄 요약
  html: string; // brand 적용된 final HTML (한 슬라이드)
  createdAt: number; // ms epoch
};

export type AIArchetypesByKey = {
  cover?: AIArchetypeEntry[];
  toc?: AIArchetypeEntry[];
  body?: AIArchetypeEntry[];
  table?: AIArchetypeEntry[];
  chart?: AIArchetypeEntry[];
  image?: AIArchetypeEntry[];
  closing?: AIArchetypeEntry[];
};

export type BrandKit = {
  primaryColor: string; // hex, "#003C71"
  accentColor: string; // hex, "#FFB81C"
  fontFamily: string; // "Pretendard", "Apple SD Gothic Neo", 등
  logoPath: string | null; // dataRoot 기준 상대 경로, null 이면 로고 없음
  archetypes?: ArchetypeMap; // v2 — 없으면 v1 호환 (모든 종류 null)
  aiArchetypes?: AIArchetypesByKey; // v3 — AI 가 만든 옵션들 (정적 옵션과 함께 갤러리 노출)
};

export type CustomTemplate = {
  id: string;
  name: string;
  brand_json: string; // JSON.stringify(BrandKit)
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
};

export const DEFAULT_BRAND_KIT: BrandKit = {
  primaryColor: "#003C71",
  accentColor: "#FFB81C",
  fontFamily: "Pretendard",
  logoPath: null,
  archetypes: {
    cover: null,
    toc: null,
    body: null,
    table: null,
    chart: null,
    image: null,
    closing: null,
  },
};

export const ALLOWED_FONTS = [
  "Pretendard",
  "Apple SD Gothic Neo",
  "Noto Sans KR",
  "Spoqa Han Sans Neo",
  "Nanum Square Round",
] as const;
