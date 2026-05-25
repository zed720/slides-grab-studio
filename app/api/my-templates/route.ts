import { NextResponse } from "next/server";
import {
  createCustomTemplate,
  listCustomTemplates,
  parseBrand,
} from "@/lib/db/queries/custom-templates";

export async function GET() {
  const list = listCustomTemplates();
  return NextResponse.json({
    templates: list.map((t) => ({
      id: t.id,
      name: t.name,
      brand: parseBrand(t),
      updatedAt: t.updated_at,
    })),
  });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { name?: string };
  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json(
      { error: "양식 이름을 적어 주세요." },
      { status: 400 },
    );
  }
  if (name.length > 80) {
    return NextResponse.json(
      { error: "양식 이름은 80자 이내여야 해요." },
      { status: 400 },
    );
  }
  const tpl = createCustomTemplate({ name });
  return NextResponse.json({
    template: { id: tpl.id, name: tpl.name, brand: parseBrand(tpl) },
  });
}
