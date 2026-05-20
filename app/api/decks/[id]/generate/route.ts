import { NextResponse } from "next/server";
import { getDeck } from "@/lib/db/queries/decks";
import { startPlanning } from "@/lib/decks/generator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;
  const deck = getDeck(id);
  if (!deck) {
    return NextResponse.json(
      { error: "발표 자료를 찾지 못했어요." },
      { status: 404 },
    );
  }

  try {
    // 새 흐름 — plan only. design+validate 는 outline 검토 후 /api/decks/[id]/start 가 호출.
    const result = startPlanning(id);
    return NextResponse.json({ ...result, status: getDeck(id)?.status ?? null });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "슬라이드 생성을 시작하지 못했어요.",
      },
      { status: 500 },
    );
  }
}
