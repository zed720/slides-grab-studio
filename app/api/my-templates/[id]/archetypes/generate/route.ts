import { NextResponse } from "next/server";
import path from "node:path";
import {
  addAIArchetype,
  getCustomTemplate,
  parseBrand,
} from "@/lib/db/queries/custom-templates";
import { generateArchetypeOptions } from "@/lib/custom-templates/ai-generation";
import type { ArchetypeKey } from "@/lib/custom-templates/types";
import { getArchetypeOption } from "@/lib/custom-templates/archetypes";
import { dataRoot } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ARCH_KEYS: ArchetypeKey[] = [
  "cover",
  "toc",
  "body",
  "table",
  "chart",
  "image",
  "closing",
];

// 동시에 한 양식에 한 generation 만. in-memory.
const generating = new Set<string>();

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

  if (generating.has(id)) {
    return NextResponse.json(
      { error: "이 양식에 대해 이미 AI 가 만드는 중이에요. 끝나면 다시 시도해 주세요." },
      { status: 409 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    archKey?: string;
    prompt?: string;
    chips?: unknown;
    count?: number;
    provider?: string;
  };

  // 검증
  if (
    !body.archKey ||
    !(ARCH_KEYS as string[]).includes(body.archKey)
  ) {
    return NextResponse.json(
      { error: "어떤 종류의 슬라이드인지 알려 주세요." },
      { status: 400 },
    );
  }
  const archKey = body.archKey as ArchetypeKey;

  // archetype 메타 존재 확인 (혹시 v3 minimal 에선 cover 만 허용하려면 여기서 막음)
  // 일단 7 종 다 허용.
  if (!getArchetypeOption(archKey, "A")) {
    // 정적 옵션 자체가 없는 archetype 이면 안전하게 막음
    return NextResponse.json(
      { error: "아직 이 종류는 AI 생성을 지원하지 않아요." },
      { status: 400 },
    );
  }

  const count = Math.max(1, Math.min(3, Number(body.count ?? 2)));
  const prompt =
    typeof body.prompt === "string" ? body.prompt.slice(0, 500) : "";
  const chips = Array.isArray(body.chips)
    ? body.chips
        .filter((c): c is string => typeof c === "string" && c.length > 0)
        .slice(0, 10)
    : [];
  const provider: "claude-code" | "codex" =
    body.provider === "codex" ? "codex" : "claude-code";

  const brand = parseBrand(tpl);
  const logoAbs = brand.logoPath
    ? path.resolve(dataRoot(), brand.logoPath)
    : null;

  generating.add(id);
  try {
    const entries = await generateArchetypeOptions({
      templateId: id,
      brand,
      archKey,
      prompt,
      chips,
      count,
      provider,
      logoAbsolutePath: logoAbs,
    });
    // 영구 저장 — brand_json 안 aiArchetypes 에 push
    for (const e of entries) {
      addAIArchetype(id, e);
    }
    return NextResponse.json({ entries });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI 생성에 실패했어요.";
    console.error("[ai-archetype]", id, archKey, message);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    generating.delete(id);
  }
}
