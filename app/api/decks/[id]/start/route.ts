import { NextResponse } from "next/server";
import { getDeck } from "@/lib/db/queries/decks";
import { startDesign } from "@/lib/decks/generator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// "이대로 만들기" — outline 검토 끝. design + validate 시작.
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
    const result = startDesign(id);
    if (!result.started) {
      return NextResponse.json(
        { error: "지금은 시작할 수 없어요." },
        { status: 400 },
      );
    }
    return NextResponse.json({ started: true });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "슬라이드 만들기를 시작하지 못했어요.",
      },
      { status: 400 },
    );
  }
}
