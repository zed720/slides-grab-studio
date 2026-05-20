import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import { getDeck } from "@/lib/db/queries/decks";
import { listSlidesByDeck } from "@/lib/db/queries/slides";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; idx: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id, idx: idxStr } = await params;
  const idx = Number.parseInt(idxStr, 10);
  if (!Number.isInteger(idx) || idx < 0) {
    return NextResponse.json(
      { error: "잘못된 슬라이드 번호예요." },
      { status: 400 },
    );
  }

  const deck = getDeck(id);
  if (!deck) {
    return NextResponse.json(
      { error: "발표 자료를 찾지 못했어요." },
      { status: 404 },
    );
  }

  const slide = listSlidesByDeck(id).find((s) => s.idx === idx);
  if (!slide) {
    return NextResponse.json(
      { error: "아직 만들어지지 않은 슬라이드예요." },
      { status: 404 },
    );
  }

  let html: string;
  try {
    html = await fs.readFile(slide.html_path, "utf-8");
  } catch {
    return NextResponse.json(
      { error: "슬라이드 파일을 읽지 못했어요." },
      { status: 500 },
    );
  }

  // 슬라이드 HTML 안의 상대 경로 (`./assets/foo.png` 등) 가 iframe 안에서
  // 우리의 files 라우트로 풀리도록 <base> 태그를 <head> 첫 줄에 삽입.
  const basePath = `/api/decks/${id}/files/`;
  const baseTag = `<base href="${basePath}">`;
  if (/<head\b[^>]*>/i.test(html)) {
    html = html.replace(/<head\b[^>]*>/i, (m) => m + baseTag);
  } else {
    // <head> 없으면 fallback — HTML 맨 앞에 붙임 (드물지만 안전망)
    html = baseTag + html;
  }

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
