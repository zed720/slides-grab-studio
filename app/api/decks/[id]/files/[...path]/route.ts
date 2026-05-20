import { NextResponse } from "next/server";
import fssync from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { getDeck } from "@/lib/db/queries/decks";
import { deckOutputDir } from "@/lib/storage";

// deck 의 output/ 폴더 안 파일을 그대로 stream — assets/flower.png 같은 슬라이드 리소스용.
// slide HTML 안의 `./assets/...` 가 iframe 의 base ("/api/decks/<id>/files/") 기준으로 풀려서 이 라우트로 떨어짐.
// path traversal 방어: `..` / 빈 segment / `/` 시작 거부 + resolve 후 outputDir 밖이면 거부.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; path: string[] }> };

export async function GET(_req: Request, { params }: Params) {
  const { id, path: parts } = await params;

  const deck = getDeck(id);
  if (!deck) {
    return NextResponse.json(
      { error: "발표 자료를 찾지 못했어요." },
      { status: 404 },
    );
  }

  if (!parts || parts.length === 0) {
    return NextResponse.json({ error: "잘못된 경로" }, { status: 400 });
  }
  for (const p of parts) {
    if (
      !p ||
      p === "." ||
      p === ".." ||
      p.includes("\0") ||
      p.startsWith("/")
    ) {
      return NextResponse.json({ error: "잘못된 경로" }, { status: 400 });
    }
  }

  const outputDir = path.resolve(deckOutputDir(id));
  const target = path.resolve(outputDir, ...parts);
  if (!target.startsWith(outputDir + path.sep)) {
    return NextResponse.json({ error: "잘못된 경로" }, { status: 400 });
  }

  if (!fssync.existsSync(target) || !fssync.statSync(target).isFile()) {
    return NextResponse.json(
      { error: "파일을 찾지 못했어요." },
      { status: 404 },
    );
  }

  const stat = fssync.statSync(target);
  const stream = fssync.createReadStream(target);
  const webStream = Readable.toWeb(stream) as unknown as ReadableStream;

  return new Response(webStream, {
    headers: {
      "Content-Type": guessMime(target),
      "Content-Length": String(stat.size),
      "Cache-Control": "no-store",
    },
  });
}

function guessMime(file: string): string {
  const ext = path.extname(file).toLowerCase();
  switch (ext) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".svg":
      return "image/svg+xml";
    case ".mp4":
      return "video/mp4";
    case ".webm":
      return "video/webm";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".woff":
      return "font/woff";
    case ".woff2":
      return "font/woff2";
    case ".ttf":
      return "font/ttf";
    case ".html":
    case ".htm":
      return "text/html; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}
