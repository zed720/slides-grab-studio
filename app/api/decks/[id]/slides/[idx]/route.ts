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

  // slides-grab editor 의 selection overlay (contentEditable + 녹색 dashed outline)
  // 가 우리 patch + throttled auto-save 가 겹치는 타이밍에 디스크에 영구 저장되는
  // 경우가 있다. 미리보기 iframe 에 그대로 노출되면 텍스트 caret + 점선 박스가 보여
  // 사용자가 혼란. 응답 직전 strip — 디스크 파일은 그대로 두고 사용자가 보는 HTML 만 깨끗.
  html = stripEditorSelectionArtifacts(html);

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

// patch 가 selection 시 박는 표시들:
//   contenteditable="true"
//   spellcheck="false"
//   style="outline: 2px dashed rgba(52, 211, 153, 0.7); ..."
// 이 셋을 strip. 다른 outline (slide 디자인 자체의 outline) 은 보존.
function stripEditorSelectionArtifacts(html: string): string {
  let out = html;

  // contenteditable="true" / contenteditable (값 없는) — 속성 자체 제거
  out = out.replace(/\s+contenteditable\s*=\s*"[^"]*"/gi, "");
  out = out.replace(/\s+contenteditable\s*=\s*'[^']*'/gi, "");
  out = out.replace(/\s+contenteditable(?=[\s>])/gi, "");

  // spellcheck="false" / spellcheck — 우리 patch 가 같이 박음
  out = out.replace(/\s+spellcheck\s*=\s*"[^"]*"/gi, "");
  out = out.replace(/\s+spellcheck\s*=\s*'[^']*'/gi, "");

  // 녹색 dashed outline — 우리 patch 가 박는 정확한 값. 다른 outline 은 유지.
  // 매칭: `outline: 2px dashed rgba(52, 211, 153, ...)` 와 그 뒤의 ; (있으면).
  out = out.replace(
    /outline\s*:\s*2px\s+dashed\s+rgba\(\s*52\s*,\s*211\s*,\s*153[^)]*\)\s*;?/gi,
    "",
  );

  // style="" 가 빈 채로 남으면 그것도 제거 (선택 사항, 깔끔함)
  out = out.replace(/\s+style\s*=\s*"\s*"/gi, "");
  out = out.replace(/\s+style\s*=\s*'\s*'/gi, "");

  return out;
}
