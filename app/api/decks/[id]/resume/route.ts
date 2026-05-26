import { NextResponse } from "next/server";
import { getDeck } from "@/lib/db/queries/decks";
import { resumeDesign } from "@/lib/decks/generator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// "이어서 만들기" — failed deck 의 부분 진행 (디스크 slide-NN.html 들 + outline.md)
// 보존하고 그 다음 장부터 만들기. AI 호출 토큰 절약.
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
    const result = resumeDesign(id);
    if (!result.started) {
      return NextResponse.json({ error: result.reason }, { status: 400 });
    }
    return NextResponse.json({ started: true });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "이어 만들기를 시작하지 못했어요.",
      },
      { status: 400 },
    );
  }
}
