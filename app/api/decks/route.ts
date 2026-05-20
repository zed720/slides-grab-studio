import { NextResponse } from "next/server";
import { listAllDecks } from "@/lib/db/queries/decks";
import { listSlidesByDeck } from "@/lib/db/queries/slides";
import { plannedSlideTotal } from "@/lib/decks/generator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const decks = listAllDecks();
  const items = decks.map((d) => ({
    id: d.id,
    title: d.title,
    status: d.status,
    plannedTotal: plannedSlideTotal(d),
    completedCount: listSlidesByDeck(d.id).length,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  }));
  return NextResponse.json(
    { decks: items },
    { headers: { "Cache-Control": "no-store" } },
  );
}
