import { NextResponse } from "next/server";
import {
  getCustomTemplate,
  removeAIArchetype,
} from "@/lib/db/queries/custom-templates";
import type { ArchetypeKey } from "@/lib/custom-templates/types";

const ARCH_KEYS: ArchetypeKey[] = [
  "cover",
  "toc",
  "body",
  "table",
  "chart",
  "image",
  "closing",
];

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; archKey: string; entryId: string }> },
) {
  const { id, archKey, entryId } = await ctx.params;
  const tpl = getCustomTemplate(id);
  if (!tpl || tpl.deleted_at !== null) {
    return NextResponse.json(
      { error: "양식을 찾을 수 없어요." },
      { status: 404 },
    );
  }
  if (!(ARCH_KEYS as string[]).includes(archKey)) {
    return NextResponse.json(
      { error: "알 수 없는 archetype." },
      { status: 400 },
    );
  }
  if (!entryId.startsWith("ai-")) {
    return NextResponse.json(
      { error: "AI 가 만든 옵션만 삭제할 수 있어요." },
      { status: 400 },
    );
  }
  removeAIArchetype(id, archKey as ArchetypeKey, entryId);
  return NextResponse.json({ ok: true });
}
