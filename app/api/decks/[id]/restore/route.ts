import { NextResponse } from "next/server";
import { getDeck, restoreDeck } from "@/lib/db/queries/decks";

// 휴지통에서 복원 — deleted_at 해제. 디스크 파일은 그대로라 즉시 복귀.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: RouteParams) {
  const { id } = await params;
  const deck = getDeck(id);
  if (!deck) {
    return NextResponse.json(
      { error: "발표 자료를 찾지 못했어요." },
      { status: 404 },
    );
  }
  if (deck.deleted_at === null) {
    return NextResponse.json(
      { error: "휴지통에 있는 자료가 아니에요." },
      { status: 400 },
    );
  }
  restoreDeck(id);
  return NextResponse.json({ ok: true });
}
