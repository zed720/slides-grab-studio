import { NextResponse } from "next/server";
import {
  startExport,
  VALID_FORMATS,
  type ExportFormat,
} from "@/lib/decks/export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "요청 본문이 잘못됐어요." },
      { status: 400 },
    );
  }

  const format = (body as { format?: unknown })?.format;
  if (
    typeof format !== "string" ||
    !VALID_FORMATS.includes(format as ExportFormat)
  ) {
    return NextResponse.json(
      { error: "지원하지 않는 형식이에요." },
      { status: 400 },
    );
  }

  const result = startExport(id, format as ExportFormat);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ jobId: result.jobId });
}
