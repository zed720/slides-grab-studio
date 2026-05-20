import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";
import { getDeck } from "@/lib/db/queries/decks";
import { deckDir } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// outline.md 위치 — generator 가 plan 단계에서 만드는 위치와 일치
function outlinePath(id: string): string {
  return path.join(deckDir(id), "slide-outline.md");
}

// GET — 현재 outline 내용 반환 (없으면 404)
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const deck = getDeck(id);
  if (!deck) {
    return NextResponse.json(
      { error: "발표 자료를 찾지 못했어요." },
      { status: 404 },
    );
  }
  const p = outlinePath(id);
  if (!fssync.existsSync(p)) {
    return NextResponse.json(
      { error: "outline 이 아직 만들어지지 않았어요." },
      { status: 404 },
    );
  }
  const content = await fs.readFile(p, "utf-8");
  return NextResponse.json(
    { content },
    { headers: { "Cache-Control": "no-store" } },
  );
}

// PUT — 사용자 편집 내용 저장 (덮어쓰기). status === "outline-ready" 만 허용.
export async function PUT(req: Request, { params }: Params) {
  const { id } = await params;
  const deck = getDeck(id);
  if (!deck) {
    return NextResponse.json(
      { error: "발표 자료를 찾지 못했어요." },
      { status: 404 },
    );
  }
  if (deck.status !== "outline-ready") {
    return NextResponse.json(
      { error: "검토 단계가 아니라 수정할 수 없어요." },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "요청 본문이 잘못됐어요." },
      { status: 400 },
    );
  }
  const content = (body as { content?: unknown })?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    return NextResponse.json(
      { error: "내용이 비었어요." },
      { status: 400 },
    );
  }

  // 덮어쓰기 전에 직전 outline 을 .bak 으로 한 벌 남긴다 — 사용자가 outline 을
  // 잘못 고쳐 design 이 실패했을 때 data/decks/<id>/slide-outline.md.bak 에서
  // 직접 되돌릴 수 있는 최소 안전망. revision 히스토리는 Phase 1 범위 밖이므로
  // .bak 한 개만 유지 (매번 덮어씀).
  const current = outlinePath(id);
  if (fssync.existsSync(current)) {
    try {
      await fs.copyFile(current, `${current}.bak`);
    } catch (err) {
      console.error("[outline] backup failed", id, err);
    }
  }

  await fs.writeFile(current, content, "utf-8");
  return NextResponse.json({ saved: true });
}
