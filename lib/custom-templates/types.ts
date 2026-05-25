// 사용자가 등록한 회사 양식 — brand kit (로고·색·폰트) 만 v1.
// archetype 갤러리 + AI 새 모양 만들기는 v2/v3.

export type BrandKit = {
  primaryColor: string; // hex, "#003C71"
  accentColor: string; // hex, "#FFB81C"
  fontFamily: string; // "Pretendard", "Apple SD Gothic Neo", 등
  logoPath: string | null; // dataRoot 기준 상대 경로, null 이면 로고 없음
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
};

export const ALLOWED_FONTS = [
  "Pretendard",
  "Apple SD Gothic Neo",
  "Noto Sans KR",
  "Spoqa Han Sans Neo",
  "Nanum Square Round",
] as const;
