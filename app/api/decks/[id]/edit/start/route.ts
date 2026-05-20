import { NextResponse } from "next/server";
import { startEditor } from "@/lib/decks/editor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;
  try {
    const { port } = await startEditor(id);
    return NextResponse.json({ port, url: `http://localhost:${port}` });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "수정 도구를 켜지 못했어요.",
      },
      { status: 500 },
    );
  }
}
