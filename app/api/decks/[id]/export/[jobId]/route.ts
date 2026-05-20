import { NextResponse } from "next/server";
import { getJob } from "@/lib/decks/export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; jobId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id, jobId } = await params;
  const job = getJob(id, jobId);
  if (!job) {
    return NextResponse.json(
      { error: "내보내기 작업을 찾지 못했어요." },
      { status: 404 },
    );
  }
  return NextResponse.json(
    {
      jobId: job.id,
      status: job.status,
      format: job.format,
      filename: job.filename,
      sizeBytes: job.sizeBytes ?? null,
      error: job.error ?? null,
      downloadUrl:
        job.status === "done"
          ? `/api/decks/${id}/export/${jobId}/file`
          : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
