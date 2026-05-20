import { NextResponse } from "next/server";
import { getDeck, updateDeck } from "@/lib/db/queries/decks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params;
  const deck = getDeck(id);
  if (!deck) {
    return NextResponse.json(
      { error: "발표 자료를 찾지 못했어요." },
      { status: 404 },
    );
  }
  return NextResponse.json({ deck });
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const deck = getDeck(id);
  if (!deck) {
    return NextResponse.json(
      { error: "발표 자료를 찾지 못했어요." },
      { status: 404 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 본문이 잘못됐어요." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "요청 본문이 잘못됐어요." }, { status: 400 });
  }

  const { templateId } = body as { templateId?: unknown };
  if (templateId !== undefined && typeof templateId !== "string") {
    return NextResponse.json(
      { error: "templateId 는 문자열이어야 해요." },
      { status: 400 },
    );
  }

  updateDeck(id, { template_id: templateId ?? null });
  const updated = getDeck(id);
  return NextResponse.json({ deck: updated });
}
