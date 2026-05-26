import { NextResponse } from "next/server";
import {
  ALLOWED_CLAUDE_MODELS,
  getClaudeModel,
  setClaudeModel,
  type ClaudeModelChoice,
} from "@/lib/db/queries/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { claudeModel: getClaudeModel() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    claudeModel?: unknown;
  };
  if (body.claudeModel !== undefined) {
    const v = body.claudeModel;
    if (typeof v !== "string" || !(ALLOWED_CLAUDE_MODELS as string[]).includes(v)) {
      return NextResponse.json(
        { error: "지원하지 않는 모델이에요." },
        { status: 400 },
      );
    }
    setClaudeModel(v as ClaudeModelChoice);
  }
  return NextResponse.json({ claudeModel: getClaudeModel() });
}
