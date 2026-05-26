import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";
import {
  createDraftDeck,
  getDeck,
  updateDeck,
} from "@/lib/db/queries/decks";
import { ensureDefaultProject } from "@/lib/db/queries/projects";
import { deckDir, deckUploadsDir, ensureDir } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// 원본 deck 의 outline 그대로 두고, 같은 source_text/provider/template 로
// 새 deck 만들기. plan 단계 건너뛰고 outline-ready 부터 시작 → 사용자가
// outline 페이지에서 검토 후 "이대로 만들기" 누르면 design 시작.
// 원본은 그대로 유지 (사용자가 두 결과 비교 가능).
export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;
  const src = getDeck(id);
  if (!src) {
    return NextResponse.json(
      { error: "원본 발표 자료를 찾지 못했어요." },
      { status: 404 },
    );
  }
  const srcOutline = path.join(deckDir(id), "slide-outline.md");
  if (!fssync.existsSync(srcOutline)) {
    return NextResponse.json(
      { error: "원본의 발표 구조 파일이 없어요." },
      { status: 400 },
    );
  }

  const project = ensureDefaultProject();
  const newDeck = createDraftDeck({
    projectId: project.id,
    title: `${src.title} (다시 만들기)`,
    providerId: src.provider_id,
    sourceText: src.source_text,
    // sourceFiles 는 일부러 비움 — 첨부 파일들은 outline 안에 이미 반영됐고
    // resume 흐름이 아니라 새 deck 라 outline 만 있으면 충분. 사용자가
    // 추가 첨부 필요하면 별도 작업.
  });

  // 디스크 준비 + outline 복사
  const dstDir = deckDir(newDeck.id);
  ensureDir(dstDir);
  ensureDir(deckUploadsDir(newDeck.id));
  await fs.copyFile(srcOutline, path.join(dstDir, "slide-outline.md"));

  // 원본의 _brief.md 도 있으면 같이 복사 (사용자가 outline 페이지에서 참고 가능)
  const srcBrief = path.join(deckUploadsDir(id), "_brief.md");
  if (fssync.existsSync(srcBrief)) {
    await fs.copyFile(
      srcBrief,
      path.join(deckUploadsDir(newDeck.id), "_brief.md"),
    );
  }

  // template_id 도 복사 + status 를 outline-ready 로 (plan 건너뜀)
  updateDeck(newDeck.id, {
    template_id: src.template_id,
    status: "outline-ready",
  });

  return NextResponse.json({ deckId: newDeck.id });
}
