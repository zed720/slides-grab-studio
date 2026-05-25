import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import {
  getCustomTemplate,
  parseBrand,
  updateCustomTemplate,
} from "@/lib/db/queries/custom-templates";
import { customTemplatesDir, dataRoot, ensureDir } from "@/lib/storage";

const ALLOWED_EXT = [".png", ".jpg", ".jpeg", ".svg", ".webp"] as const;
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const tpl = getCustomTemplate(id);
  if (!tpl || tpl.deleted_at !== null) {
    return NextResponse.json(
      { error: "양식을 찾을 수 없어요." },
      { status: 404 },
    );
  }

  const form = await req.formData();
  const file = form.get("logo");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "로고 파일이 없어요." },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "로고는 5MB 이하만 가능해요." },
      { status: 400 },
    );
  }
  const ext = path.extname(file.name).toLowerCase();
  if (!(ALLOWED_EXT as readonly string[]).includes(ext)) {
    return NextResponse.json(
      { error: "로고는 png/jpg/svg/webp 만 가능해요." },
      { status: 400 },
    );
  }

  const dir = customTemplatesDir(id);
  ensureDir(dir);
  const filename = `logo${ext}`;
  const absPath = path.join(dir, filename);

  // 기존 다른 확장자 로고가 있으면 정리
  try {
    const existing = await fs.readdir(dir);
    for (const f of existing) {
      if (/^logo\.(png|jpe?g|svg|webp)$/i.test(f) && f !== filename) {
        await fs.unlink(path.join(dir, f)).catch(() => {});
      }
    }
  } catch {}

  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(absPath, buf);

  // brand_json 의 logoPath 갱신 — dataRoot 기준 상대 경로
  const relativePath = path.relative(dataRoot(), absPath);
  const brand = parseBrand(tpl);
  brand.logoPath = relativePath;
  updateCustomTemplate(id, { brand });

  return NextResponse.json({
    logoPath: relativePath,
    sizeBytes: buf.byteLength,
  });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const tpl = getCustomTemplate(id);
  if (!tpl || tpl.deleted_at !== null) {
    return NextResponse.json(
      { error: "양식을 찾을 수 없어요." },
      { status: 404 },
    );
  }
  const brand = parseBrand(tpl);
  if (brand.logoPath) {
    const abs = path.join(dataRoot(), brand.logoPath);
    await fs.unlink(abs).catch(() => {});
  }
  brand.logoPath = null;
  updateCustomTemplate(id, { brand });
  return NextResponse.json({ ok: true });
}
