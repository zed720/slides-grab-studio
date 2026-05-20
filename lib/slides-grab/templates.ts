import fs from "node:fs/promises";
import { BITREE_TEMPLATE } from "./bitree-template";
import { runSlidesGrab } from "./cli";

export type Template = {
  id: string;
  name: string;
  description: string;
  previewHtml: string;
};

let cache: Template[] | null = null;

export async function listTemplates(): Promise<Template[]> {
  if (cache) return cache;

  const [listResult, previewPathResult] = await Promise.all([
    runSlidesGrab(["list-styles"]),
    runSlidesGrab(["preview-styles"]),
  ]);
  if (listResult.exitCode !== 0) {
    throw new Error(
      `slides-grab list-styles failed: ${listResult.stderr.trim() || "exit " + listResult.exitCode}`,
    );
  }
  if (previewPathResult.exitCode !== 0) {
    throw new Error(
      `slides-grab preview-styles failed: ${previewPathResult.stderr.trim() || "exit " + previewPathResult.exitCode}`,
    );
  }

  const styles = parseListStyles(listResult.stdout);
  const previewPath = previewPathResult.stdout.trim();
  const previewHtml = await fs.readFile(previewPath, "utf-8");
  const { styleBlock, perCardPreview } = parsePreviewHtml(previewHtml);

  const result: Template[] = styles.map((s, idx) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    previewHtml: wrapForIframe(styleBlock, perCardPreview[idx] ?? ""),
  }));

  // 우리 앱 자체 디자인 — 비트리. 가장 앞에 둠 (추천 위치).
  result.unshift(BITREE_TEMPLATE);

  cache = result;
  return result;
}

type ParsedStyle = { id: string; name: string; description: string };

function parseListStyles(stdout: string): ParsedStyle[] {
  const lines = stdout.split("\n");
  const out: ParsedStyle[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = /^ {2}([a-z][a-z0-9-]*)\s+(.+?)\s*$/.exec(line);
    if (!m) continue;
    const id = m[1];
    const name = m[2].trim();
    const next = lines[i + 1] ?? "";
    let description = "";
    if (/^ {4}\S/.test(next)) {
      description = next.trim();
      i++;
    }
    out.push({ id, name, description });
  }
  return out;
}

function parsePreviewHtml(html: string): {
  styleBlock: string;
  perCardPreview: string[];
} {
  const styleMatch = /<style[^>]*>([\s\S]*?)<\/style>/i.exec(html);
  const styleBlock = styleMatch ? styleMatch[1] : "";

  const perCardPreview: string[] = [];
  const cardRegex =
    /<div class="card">[\s\S]*?(<div class="preview[^"]*">)/g;
  let m: RegExpExecArray | null;
  while ((m = cardRegex.exec(html)) !== null) {
    const startTagIdx = html.indexOf(m[1], m.index);
    if (startTagIdx === -1) continue;
    const previewHtml = extractBalancedDiv(html, startTagIdx);
    perCardPreview.push(previewHtml);
  }
  return { styleBlock, perCardPreview };
}

function extractBalancedDiv(html: string, startIdx: number): string {
  let depth = 0;
  let i = startIdx;
  while (i < html.length) {
    if (html.startsWith("<div", i)) {
      depth++;
      const close = html.indexOf(">", i);
      if (close === -1) break;
      i = close + 1;
    } else if (html.startsWith("</div>", i)) {
      depth--;
      i += "</div>".length;
      if (depth === 0) return html.slice(startIdx, i);
    } else {
      i++;
    }
  }
  return "";
}

function wrapForIframe(styleBlock: string, previewBody: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
*,*::before,*::after { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 100%; height: 100%; background: transparent; overflow: hidden; }
${styleBlock}
.preview { width: 100% !important; height: 100% !important; aspect-ratio: auto !important; border-radius: 0 !important; }
</style></head><body>${previewBody}</body></html>`;
}
