import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import { getDeck, permanentDeleteDeck } from "@/lib/db/queries/decks";
import { deckDir } from "@/lib/storage";

// 영구 삭제 — 휴지통에 있는 deck 만. DB 행 + 디스크 폴더 모두 제거.
// 되돌릴 수 없음.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: RouteParams) {
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
      {
        error:
          "휴지통에 있는 자료만 완전히 지울 수 있어요. 먼저 휴지통으로 보내 주세요.",
      },
      { status: 400 },
    );
  }

  // DB 먼저 정리 — 디스크 제거 실패해도 사용자 화면에서는 사라짐.
  // ON DELETE CASCADE 로 slides 도 같이 정리.
  permanentDeleteDeck(id);

  // 디스크 폴더 제거 — 실패해도 사용자 흐름은 막지 않음 (수동 정리 가능).
  const dir = deckDir(id);
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch (err) {
    console.error("[decks] 디스크 폴더 제거 실패", id, err);
  }

  return NextResponse.json({ ok: true });
}
