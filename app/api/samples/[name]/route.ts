import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

// 환영 화면의 "샘플 빠른 시작" 이 fetch 하는 API.
// 화이트리스트로만 노출 — path traversal 방어 + 어떤 파일이 노출될지 명시적.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// name → samples/ 안의 실제 파일명
const SAMPLES: Record<string, { filename: string; title: string }> = {
  "team-retro": {
    filename: "01-팀-회고.md",
    title: "2026년 1분기 팀 회고",
  },
  onboarding: {
    filename: "02-신입-온보딩.md",
    title: "새로 오신 분께 — 첫 주 안내",
  },
};

type Params = { params: Promise<{ name: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { name } = await params;
  const meta = SAMPLES[name];
  if (!meta) {
    return NextResponse.json(
      { error: "그런 샘플이 없어요." },
      { status: 404 },
    );
  }

  const filePath = path.join(process.cwd(), "samples", meta.filename);
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return NextResponse.json({
      title: meta.title,
      content,
    });
  } catch (err) {
    console.error("[samples] read failed", name, err);
    return NextResponse.json(
      { error: "샘플 파일을 읽지 못했어요." },
      { status: 500 },
    );
  }
}
