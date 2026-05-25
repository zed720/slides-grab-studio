import { NextResponse } from "next/server";
import {
  getCustomTemplate,
  parseBrand,
  softDeleteCustomTemplate,
  updateCustomTemplate,
} from "@/lib/db/queries/custom-templates";
import type { BrandKit } from "@/lib/custom-templates/types";
import { ALLOWED_FONTS } from "@/lib/custom-templates/types";

function isHex(s: unknown): s is string {
  return typeof s === "string" && /^#[0-9a-f]{6}$/i.test(s);
}

export async function GET(
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
  return NextResponse.json({
    template: { id: tpl.id, name: tpl.name, brand: parseBrand(tpl) },
  });
}

export async function PATCH(
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
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    brand?: Partial<BrandKit>;
  };

  const patch: { name?: string; brand?: BrandKit } = {};

  if (body.name !== undefined) {
    const n = body.name.trim();
    if (!n || n.length > 80) {
      return NextResponse.json(
        { error: "양식 이름은 1~80자여야 해요." },
        { status: 400 },
      );
    }
    patch.name = n;
  }
  if (body.brand !== undefined) {
    const current = parseBrand(tpl);
    const next: BrandKit = { ...current };
    if (body.brand.primaryColor !== undefined) {
      if (!isHex(body.brand.primaryColor)) {
        return NextResponse.json(
          { error: "주 색상은 #RRGGBB 형식이어야 해요." },
          { status: 400 },
        );
      }
      next.primaryColor = body.brand.primaryColor.toUpperCase();
    }
    if (body.brand.accentColor !== undefined) {
      if (!isHex(body.brand.accentColor)) {
        return NextResponse.json(
          { error: "강조 색상은 #RRGGBB 형식이어야 해요." },
          { status: 400 },
        );
      }
      next.accentColor = body.brand.accentColor.toUpperCase();
    }
    if (body.brand.fontFamily !== undefined) {
      if (
        !(ALLOWED_FONTS as readonly string[]).includes(body.brand.fontFamily)
      ) {
        return NextResponse.json(
          { error: "지원하지 않는 글꼴이에요." },
          { status: 400 },
        );
      }
      next.fontFamily = body.brand.fontFamily;
    }
    // logoPath 는 별도 업로드 API 에서만 갱신 — body 로 직접 변경 X
    patch.brand = next;
  }

  updateCustomTemplate(id, patch);
  const fresh = getCustomTemplate(id)!;
  return NextResponse.json({
    template: { id: fresh.id, name: fresh.name, brand: parseBrand(fresh) },
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
  softDeleteCustomTemplate(id);
  return NextResponse.json({ ok: true });
}
