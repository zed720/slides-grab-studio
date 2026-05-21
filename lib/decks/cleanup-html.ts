import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";

// slides-grab editor 의 selection overlay 가 우리 contentEditable patch +
// throttled auto-save 가 겹치는 타이밍에 slide HTML 에 영구 저장되는 경우가 있다.
// 미리보기 iframe 에는 slide route 가 응답마다 strip 해 주지만, slides-grab CLI
// 가 디스크 파일을 직접 읽어 처리하는 경로 (PDF / PPTX / Figma export) 에서는
// selection overlay 가 결과물에 박힐 위험이 있다.
//
// 부팅 시 한 번 data/decks/*/output/slide-*.html 을 traverse 해서 strip + 디스크
// write-back. 이미 깨끗한 파일은 건드리지 않는다.

const SELECTION_PATTERNS: RegExp[] = [
  / contenteditable\s*=\s*"[^"]*"/gi,
  / contenteditable\s*=\s*'[^']*'/gi,
  / contenteditable(?=[\s>])/gi,
  / spellcheck\s*=\s*"[^"]*"/gi,
  / spellcheck\s*=\s*'[^']*'/gi,
  /outline\s*:\s*2px\s+dashed\s+rgba\(\s*52\s*,\s*211\s*,\s*153[^)]*\)\s*;?/gi,
];
const EMPTY_STYLE_PATTERNS: RegExp[] = [
  / style\s*=\s*"\s*"/gi,
  / style\s*=\s*'\s*'/gi,
];

function stripSelectionArtifacts(html: string): string {
  let out = html;
  for (const re of SELECTION_PATTERNS) out = out.replace(re, "");
  for (const re of EMPTY_STYLE_PATTERNS) out = out.replace(re, "");
  return out;
}

function hasSelectionArtifacts(html: string): boolean {
  return SELECTION_PATTERNS.some((re) => {
    re.lastIndex = 0;
    return re.test(html);
  });
}

async function cleanupSlideFile(filePath: string): Promise<boolean> {
  let html: string;
  try {
    html = await fs.readFile(filePath, "utf-8");
  } catch {
    return false;
  }
  if (!hasSelectionArtifacts(html)) return false;
  const cleaned = stripSelectionArtifacts(html);
  try {
    await fs.writeFile(filePath, cleaned, "utf-8");
    return true;
  } catch {
    return false;
  }
}

// 한 deck 만 cleanup — export 시작 직전 호출. 같은 세션 동안 사용자가 수정 후
// export 하는 경우 selection overlay 가 결과물에 박히는 사고 방지.
export async function cleanupDeckSlideArtifacts(deckId: string): Promise<void> {
  const outDir = path.resolve(process.cwd(), "data", "decks", deckId, "output");
  if (!fssync.existsSync(outDir)) return;
  try {
    const files = await fs.readdir(outDir);
    for (const f of files) {
      if (!/^slide-\d+\.html?$/i.test(f)) continue;
      await cleanupSlideFile(path.join(outDir, f));
    }
  } catch (err) {
    console.error("[cleanup-html] per-deck cleanup failed", deckId, err);
  }
}

// 부팅 시 한 번 — data/decks/<id>/output/slide-*.html 을 traverse.
// 에러는 삼키고 가능한 한 진행. 빈 디렉터리는 skip.
export async function cleanupAllSlideArtifacts(): Promise<void> {
  const dataDir = path.resolve(process.cwd(), "data", "decks");
  if (!fssync.existsSync(dataDir)) return;

  let cleaned = 0;
  let scanned = 0;
  try {
    const decks = await fs.readdir(dataDir);
    for (const deckId of decks) {
      const outDir = path.join(dataDir, deckId, "output");
      if (!fssync.existsSync(outDir)) continue;
      const files = await fs.readdir(outDir);
      for (const f of files) {
        if (!/^slide-\d+\.html?$/i.test(f)) continue;
        scanned++;
        const ok = await cleanupSlideFile(path.join(outDir, f));
        if (ok) cleaned++;
      }
    }
  } catch (err) {
    console.error("[cleanup-html] traverse failed", err);
    return;
  }
  if (cleaned > 0) {
    console.log(
      `[cleanup-html] selection overlay 흔적을 ${cleaned}개 슬라이드 파일에서 제거했어요 (${scanned}개 점검).`,
    );
  }
}
