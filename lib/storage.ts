import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// 데이터 루트 결정 우선순위:
// 1) 환경 변수 SLIDES_GRAB_DATA_DIR — 배포 빌드의 .app launcher 가 명시.
// 2) production + macOS → ~/Library/Application Support/Slides-Grab Studio/
//    .app 가 zip 으로 교체돼도 사용자 deck 데이터는 그대로 유지.
// 3) 그 외 (dev) → 현재 cwd 의 data/. 개발 흐름 안 바뀜.
export function dataRoot(): string {
  const env = process.env.SLIDES_GRAB_DATA_DIR;
  if (env && env.trim().length > 0) {
    return path.resolve(env.trim());
  }

  if (
    process.env.NODE_ENV === "production" &&
    process.platform === "darwin"
  ) {
    return path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "Slides-Grab Studio",
    );
  }

  return path.resolve(process.cwd(), "data");
}

export function deckDir(deckId: string): string {
  return path.join(dataRoot(), "decks", deckId);
}

export function deckUploadsDir(deckId: string): string {
  return path.join(deckDir(deckId), "uploads");
}

export function deckOutputDir(deckId: string): string {
  return path.join(deckDir(deckId), "output");
}

// 사용자 양식 (custom_templates) 별 디스크 폴더.
// 현재는 로고 이미지 (logo.png/jpg/svg/webp) 한 개만 들어감.
export function customTemplatesDir(id: string): string {
  return path.join(dataRoot(), "custom-templates", id);
}

export function ensureDir(p: string): string {
  fs.mkdirSync(p, { recursive: true });
  return p;
}
