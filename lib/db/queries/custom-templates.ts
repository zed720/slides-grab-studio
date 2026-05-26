import { randomUUID } from "node:crypto";
import { getDb } from "../index";
import type {
  AIArchetypeEntry,
  ArchetypeKey,
  BrandKit,
  CustomTemplate,
} from "@/lib/custom-templates/types";
import { DEFAULT_BRAND_KIT } from "@/lib/custom-templates/types";

export function createCustomTemplate(input: {
  name: string;
  brand?: Partial<BrandKit>;
}): CustomTemplate {
  const db = getDb();
  const now = Date.now();
  const brand: BrandKit = { ...DEFAULT_BRAND_KIT, ...(input.brand ?? {}) };
  const tpl: CustomTemplate = {
    id: randomUUID(),
    name: input.name,
    brand_json: JSON.stringify(brand),
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
  db.prepare(
    `INSERT INTO custom_templates (id, name, brand_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(tpl.id, tpl.name, tpl.brand_json, tpl.created_at, tpl.updated_at);
  return tpl;
}

export function getCustomTemplate(id: string): CustomTemplate | null {
  const db = getDb();
  return (
    (db
      .prepare("SELECT * FROM custom_templates WHERE id = ?")
      .get(id) as CustomTemplate | undefined) ?? null
  );
}

// 살아있는 양식만, 최근 수정 순.
export function listCustomTemplates(): CustomTemplate[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM custom_templates WHERE deleted_at IS NULL ORDER BY updated_at DESC",
    )
    .all() as CustomTemplate[];
}

export function updateCustomTemplate(
  id: string,
  patch: { name?: string; brand?: BrandKit },
): void {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];
  if (patch.name !== undefined) {
    fields.push("name = ?");
    values.push(patch.name);
  }
  if (patch.brand !== undefined) {
    fields.push("brand_json = ?");
    values.push(JSON.stringify(patch.brand));
  }
  if (fields.length === 0) return;
  fields.push("updated_at = ?");
  values.push(Date.now());
  values.push(id);
  db.prepare(
    `UPDATE custom_templates SET ${fields.join(", ")} WHERE id = ?`,
  ).run(...values);
}

// soft delete. 디스크의 로고 파일은 그대로 둠 (복원 시 살아나야 함).
export function softDeleteCustomTemplate(id: string): void {
  const db = getDb();
  const now = Date.now();
  db.prepare(
    "UPDATE custom_templates SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
  ).run(now, now, id);
}

export function parseBrand(tpl: CustomTemplate): BrandKit {
  try {
    return { ...DEFAULT_BRAND_KIT, ...JSON.parse(tpl.brand_json) } as BrandKit;
  } catch {
    return { ...DEFAULT_BRAND_KIT };
  }
}

// AI 생성 옵션 한 개 추가 — 해당 archetype 의 aiArchetypes 배열 끝에 push.
export function addAIArchetype(id: string, entry: AIArchetypeEntry): void {
  const tpl = getCustomTemplate(id);
  if (!tpl || tpl.deleted_at !== null) {
    throw new Error("양식을 찾을 수 없어요.");
  }
  const brand = parseBrand(tpl);
  const ai = { ...(brand.aiArchetypes ?? {}) };
  const list = [...(ai[entry.archKey] ?? []), entry];
  ai[entry.archKey] = list;
  brand.aiArchetypes = ai;
  updateCustomTemplate(id, { brand });
}

// AI 생성 옵션 한 개 삭제 — archetype + id 매칭.
export function removeAIArchetype(
  id: string,
  archKey: ArchetypeKey,
  entryId: string,
): void {
  const tpl = getCustomTemplate(id);
  if (!tpl || tpl.deleted_at !== null) return;
  const brand = parseBrand(tpl);
  const ai = { ...(brand.aiArchetypes ?? {}) };
  const list = (ai[archKey] ?? []).filter((e) => e.id !== entryId);
  ai[archKey] = list;
  brand.aiArchetypes = ai;
  updateCustomTemplate(id, { brand });
}
