import { NextResponse } from "next/server";
import { getDeck, softDeleteDeck, updateDeck } from "@/lib/db/queries/decks";
import { isBulkEditing } from "@/lib/decks/bulk-edit";
import { isExporting } from "@/lib/decks/export";

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

// 휴지통으로 이동 (soft delete). 진행 중 작업이 있으면 거부.
export async function DELETE(_req: Request, { params }: RouteParams) {
  const { id } = await params;
  const deck = getDeck(id);
  if (!deck) {
    return NextResponse.json(
      { error: "발표 자료를 찾지 못했어요." },
      { status: 404 },
    );
  }
  if (deck.deleted_at !== null) {
    return NextResponse.json(
      { error: "이미 휴지통에 있는 자료예요." },
      { status: 400 },
    );
  }
  if (deck.status === "generating" || deck.status === "outlining") {
    return NextResponse.json(
      {
        error:
          "지금 만드는 중이라 삭제할 수 없어요. 완성이나 실패 후 다시 시도해 주세요.",
      },
      { status: 409 },
    );
  }
  if (isExporting(id) || isBulkEditing(id)) {
    return NextResponse.json(
      {
        error:
          "지금 다른 작업이 진행 중이라 삭제할 수 없어요. 끝난 뒤 다시 시도해 주세요.",
      },
      { status: 409 },
    );
  }

  softDeleteDeck(id);
  return NextResponse.json({ ok: true });
}
