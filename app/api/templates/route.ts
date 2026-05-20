import { NextResponse } from "next/server";
import { listTemplates } from "@/lib/slides-grab/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const templates = await listTemplates();
    return NextResponse.json(
      { templates },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "디자인 목록을 불러오지 못했어요.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
