import { NextResponse } from "next/server";
import { buildPreviewHtml } from "@/lib/custom-templates/preview";
import {
  getCustomTemplate,
  parseBrand,
} from "@/lib/db/queries/custom-templates";
import type {
  ArchetypeKey,
  ArchetypeMap,
  BrandKit,
} from "@/lib/custom-templates/types";
import { ALLOWED_FONTS } from "@/lib/custom-templates/types";
import { getArchetypeOption } from "@/lib/custom-templates/archetypes";

const ARCH_KEYS: ArchetypeKey[] = [
  "cover",
  "toc",
  "body",
  "table",
  "chart",
  "image",
  "closing",
];

function isHex(s: string | null): s is string {
  return !!s && /^#[0-9a-f]{6}$/i.test(s);
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const tpl = getCustomTemplate(id);
  if (!tpl || tpl.deleted_at !== null) {
    return new NextResponse("not found", { status: 404 });
  }

  // 빌더에서 브랜드 바꾸는 중인 값을 query 로 override 받음 — 저장 전에도 즉시 반영.
  const url = new URL(req.url);
  const stored = parseBrand(tpl);
  const primary = url.searchParams.get("primary");
  const accent = url.searchParams.get("accent");
  const font = url.searchParams.get("font");

  const brand: BrandKit = {
    ...stored,
    primaryColor: isHex(primary) ? primary.toUpperCase() : stored.primaryColor,
    accentColor: isHex(accent) ? accent.toUpperCase() : stored.accentColor,
    fontFamily:
      font && (ALLOWED_FONTS as readonly string[]).includes(font)
        ? font
        : stored.fontFamily,
  };

  // archetype 도 query 로 override 가능 (빌더가 옵션 토글하는 중에도 즉시 반영).
  // 빈 문자열이면 "안 고름" 으로 처리. query 없으면 저장된 값 fallback.
  const archetypes: ArchetypeMap = {};
  for (const k of ARCH_KEYS) {
    const q = url.searchParams.get(k);
    if (q !== null) {
      archetypes[k] =
        q.length > 0 && getArchetypeOption(k, q) ? q : null;
    } else {
      archetypes[k] = stored.archetypes?.[k] ?? null;
    }
  }

  const logoUrl = brand.logoPath ? `/api/my-templates/${id}/logo/file` : null;
  const html = buildPreviewHtml({ brand, logoUrl, archetypes });
  return new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-cache",
    },
  });
}
