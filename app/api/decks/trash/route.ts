import { NextResponse } from "next/server";
import { listTrashedDecks } from "@/lib/db/queries/decks";
import { listSlidesByDeck } from "@/lib/db/queries/slides";
import { plannedSlideTotal } from "@/lib/decks/generator";

// 휴지통 목록 — deleted_at IS NOT NULL.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const decks = listTrashedDecks();
  const items = decks.map((d) => ({
    id: d.id,
    title: d.title,
    status: d.status,
    plannedTotal: plannedSlideTotal(d),
    completedCount: listSlidesByDeck(d.id).length,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
    deletedAt: d.deleted_at,
  }));
  return NextResponse.json(
    { decks: items },
    { headers: { "Cache-Control": "no-store" } },
  );
}
