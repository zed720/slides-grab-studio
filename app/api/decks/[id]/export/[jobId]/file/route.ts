import { NextResponse } from "next/server";
import fssync from "node:fs";
import { Readable } from "node:stream";
import { getJob, mimeForFormat } from "@/lib/decks/export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; jobId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id, jobId } = await params;
  const job = getJob(id, jobId);
  if (!job || job.status !== "done" || !job.filePath) {
    return NextResponse.json(
      { error: "내보내기 파일을 찾지 못했어요." },
      { status: 404 },
    );
  }
  if (!fssync.existsSync(job.filePath)) {
    return NextResponse.json(
      { error: "내보내기 파일을 찾지 못했어요." },
      { status: 404 },
    );
  }

  const stream = fssync.createReadStream(job.filePath);
  // Node Readable → Web ReadableStream (Node 20+)
  const webStream = Readable.toWeb(stream) as unknown as ReadableStream;

  return new Response(webStream, {
    headers: {
      "Content-Type": mimeForFormat(job.format),
      "Content-Length": String(job.sizeBytes ?? ""),
      // 한글 파일명 안전 — RFC 5987 인코딩
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
        job.filename,
      )}`,
      "Cache-Control": "no-store",
    },
  });
}
