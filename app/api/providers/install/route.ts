import { NextResponse } from "next/server";
import type { ProviderId } from "@/lib/providers";
import { startBodyInstall } from "@/lib/providers/install-body";

// Claude Code / Codex 본체 자동 설치 트리거.
// 진행 상태는 일반 `/api/providers` detect 의 `bodyInstall` 필드로 폴링.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID: ProviderId[] = ["claude-code", "codex"];

export async function POST(req: Request) {
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {}
  const raw = (body as { provider?: unknown })?.provider;
  if (typeof raw !== "string" || !VALID.includes(raw as ProviderId)) {
    return NextResponse.json(
      { error: "어떤 도구를 설치할지 알려주세요." },
      { status: 400 },
    );
  }

  const result = startBodyInstall(raw as ProviderId);
  if (!result.started) {
    return NextResponse.json(
      { error: result.reason ?? "시작하지 못했어요." },
      { status: 400 },
    );
  }
  return NextResponse.json({ started: true });
}
