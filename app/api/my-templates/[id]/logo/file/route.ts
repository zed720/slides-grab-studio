import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import {
  getCustomTemplate,
  parseBrand,
} from "@/lib/db/queries/custom-templates";
import { dataRoot } from "@/lib/storage";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const tpl = getCustomTemplate(id);
  if (!tpl || tpl.deleted_at !== null) {
    return new NextResponse("not found", { status: 404 });
  }
  const brand = parseBrand(tpl);
  if (!brand.logoPath) {
    return new NextResponse("no logo", { status: 404 });
  }
  // path traversal 방지 — dataRoot 안에 있는지 확인
  const root = path.resolve(dataRoot());
  const abs = path.resolve(root, brand.logoPath);
  if (!abs.startsWith(root + path.sep)) {
    return new NextResponse("forbidden", { status: 403 });
  }
  const buf = await fs.readFile(abs).catch(() => null);
  if (!buf) {
    return new NextResponse("not found", { status: 404 });
  }
  const ext = path.extname(abs).toLowerCase();
  return new NextResponse(buf, {
    headers: {
      "content-type": MIME[ext] ?? "application/octet-stream",
      "cache-control": "no-cache",
    },
  });
}
