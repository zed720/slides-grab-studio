import { NextResponse } from "next/server";
import { listTemplates } from "@/lib/slides-grab/templates";
import {
  listCustomTemplates,
  parseBrand,
} from "@/lib/db/queries/custom-templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const slidesGrab = await listTemplates();

    // 사용자 양식 — id 에 "custom:" prefix, previewHtml 은 비우고 클라이언트가
    // /api/my-templates/<id>/preview 를 iframe src 로 직접 띄움 (custom 플래그).
    const customs = listCustomTemplates();
    const customAsTemplate = customs.map((c) => {
      const brand = parseBrand(c);
      return {
        id: `custom:${c.id}`,
        name: c.name,
        description: `내 양식 · ${brand.primaryColor} / ${brand.accentColor}`,
        previewHtml: "",
        custom: true as const,
        updatedAt: c.updated_at,
      };
    });

    return NextResponse.json(
      { templates: [...customAsTemplate, ...slidesGrab] },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "디자인 목록을 불러오지 못했어요.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
