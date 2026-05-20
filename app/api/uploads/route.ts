import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { getDb } from "@/lib/db";
import { createDraftDeck } from "@/lib/db/queries/decks";
import { ensureDefaultProject } from "@/lib/db/queries/projects";
import { deckUploadsDir, ensureDir } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SavedFile = {
  filename: string;
  size: number;
  mime: string;
  path: string;
};

const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50MB / 파일
const MAX_TOTAL_BYTES = 200 * 1024 * 1024; // 200MB / 요청
const ALLOWED_EXTS = new Set([".md", ".txt", ".pdf", ".docx", ".pptx"]);

function formatMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export async function POST(req: Request) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "파일을 읽지 못했어요. 다시 시도해 주세요." },
      { status: 400 },
    );
  }

  const title = String(formData.get("title") ?? "").trim();
  if (!title) {
    return NextResponse.json(
      { error: "발표 제목을 입력해 주세요." },
      { status: 400 },
    );
  }

  const text = String(formData.get("text") ?? "").trim();
  const slideCount = String(formData.get("slideCount") ?? "").trim();
  const tone = String(formData.get("tone") ?? "").trim();
  const providerIdRaw = String(formData.get("providerId") ?? "").trim();
  const providerId = providerIdRaw || null;

  const files = formData
    .getAll("files")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (!text && files.length === 0) {
    return NextResponse.json(
      { error: "내용을 텍스트로 적거나 파일을 한 개 이상 올려주세요." },
      { status: 400 },
    );
  }

  let totalBytes = 0;
  for (const f of files) {
    const ext = path.extname(f.name).toLowerCase();
    if (!ALLOWED_EXTS.has(ext)) {
      return NextResponse.json(
        {
          error: `지원하지 않는 파일 형식이에요: ${f.name}. .md / .txt / .pdf / .docx / .pptx 만 올릴 수 있어요.`,
        },
        { status: 400 },
      );
    }
    if (f.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        {
          error: `파일이 너무 커요: ${f.name} (${formatMb(f.size)}). 한 파일당 ${formatMb(MAX_FILE_BYTES)} 까지만 가능해요.`,
        },
        { status: 400 },
      );
    }
    totalBytes += f.size;
  }
  if (totalBytes > MAX_TOTAL_BYTES) {
    return NextResponse.json(
      {
        error: `한꺼번에 올린 파일이 너무 많아요 (${formatMb(totalBytes)}). 모두 합쳐 ${formatMb(MAX_TOTAL_BYTES)} 이하로 줄여 주세요.`,
      },
      { status: 413 },
    );
  }

  const sourceText = composeSourceText({ slideCount, tone, text });

  const project = ensureDefaultProject();
  const deck = createDraftDeck({
    projectId: project.id,
    title,
    providerId,
    sourceText,
  });

  // uploads 디렉터리는 deck 만들면 항상 보장 (brief.md 쓸 자리)
  const dir = ensureDir(deckUploadsDir(deck.id));

  const saved: SavedFile[] = [];
  for (const file of files) {
    const safeName = path.basename(file.name);
    const dst = path.join(dir, safeName);
    const buf = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(dst, buf);
    saved.push({
      filename: safeName,
      size: file.size,
      mime: file.type || "application/octet-stream",
      path: dst,
    });
  }

  // _brief.md — AI 가 읽을 사용자 입력 합성. 항상 작성.
  const briefMd = composeBriefMd({ title, slideCount, tone, text, saved });
  await fs.writeFile(path.join(dir, "_brief.md"), briefMd, "utf-8");

  if (saved.length > 0) {
    const db = getDb();
    db.prepare(
      "UPDATE decks SET source_files_json = ?, updated_at = ? WHERE id = ?",
    ).run(JSON.stringify(saved), Date.now(), deck.id);
  }

  return NextResponse.json({ deckId: deck.id });
}

function composeSourceText({
  slideCount,
  tone,
  text,
}: {
  slideCount: string;
  tone: string;
  text: string;
}): string | null {
  const lines: string[] = [];
  if (slideCount) lines.push(`분량: ${slideCount}`);
  if (tone) lines.push(`분위기: ${tone}`);
  const head = lines.join("\n");
  const composed = [head, text].filter((s) => s.length > 0).join("\n\n");
  return composed.length > 0 ? composed : null;
}

function composeBriefMd({
  title,
  slideCount,
  tone,
  text,
  saved,
}: {
  title: string;
  slideCount: string;
  tone: string;
  text: string;
  saved: SavedFile[];
}): string {
  const parts: string[] = [];
  parts.push(`# ${title}`);
  parts.push("");
  parts.push("## 발표 의도");
  if (slideCount) parts.push(`- 분량: ${slideCount}`);
  if (tone) parts.push(`- 분위기: ${tone}`);
  if (!slideCount && !tone) parts.push("- (별도 지정 없음)");
  parts.push("");
  if (saved.length > 0) {
    parts.push("## 함께 올린 파일");
    for (const f of saved) {
      parts.push(`- \`${f.filename}\` (${f.mime}, ${f.size} bytes)`);
    }
    parts.push("");
    parts.push("> 이 파일들은 같은 폴더에 있어요. 필요하면 직접 읽어 참고해 주세요.");
    parts.push("");
  }
  if (text) {
    parts.push("## 본문 / 메모");
    parts.push("");
    parts.push(text);
    parts.push("");
  } else {
    parts.push("## 본문");
    parts.push("");
    parts.push("(첨부 파일을 주된 내용으로 사용해 주세요.)");
    parts.push("");
  }
  return parts.join("\n");
}
