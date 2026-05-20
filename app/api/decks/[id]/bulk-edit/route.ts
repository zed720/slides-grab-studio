import { NextResponse } from "next/server";
import { getDeck } from "@/lib/db/queries/decks";
import { startBulkEdit } from "@/lib/decks/bulk-edit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
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
    return NextResponse.json(
      { error: "요청 본문이 잘못됐어요." },
      { status: 400 },
    );
  }

  const instruction =
    typeof body === "object" && body !== null && "instruction" in body
      ? String((body as { instruction?: unknown }).instruction ?? "")
      : "";

  try {
    const result = startBulkEdit(id, instruction);
    return NextResponse.json({
      ...result,
      status: getDeck(id)?.status ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "일괄 수정을 시작하지 못했어요.",
      },
      { status: 400 },
    );
  }
}
