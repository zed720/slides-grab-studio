import { NextResponse } from "next/server";
import type { ProviderId } from "@/lib/providers";
import { startSlidesGrabInstall } from "@/lib/providers/skills";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID: ProviderId[] = ["claude-code", "codex"];

export async function POST(req: Request) {
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // 기본 = claude-code (구버전 호환)
  }
  const raw = (body as { provider?: unknown })?.provider;
  const provider = (typeof raw === "string" && VALID.includes(raw as ProviderId)
    ? (raw as ProviderId)
    : "claude-code") as ProviderId;

  const result = startSlidesGrabInstall(provider);
  if (!result.started) {
    return NextResponse.json(
      { error: result.reason ?? "시작하지 못했어요." },
      { status: 400 },
    );
  }
  return NextResponse.json({ started: true });
}
