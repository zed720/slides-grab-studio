import { NextResponse } from "next/server";
import { stopEditor } from "@/lib/decks/editor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  stopEditor();
  return NextResponse.json({ ok: true });
}
