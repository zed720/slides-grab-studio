import { randomUUID } from "node:crypto";
import { getDb } from "../index";

// outline 검토 단계 추가 후 흐름:
//   draft → outlining → outline-ready → generating → ready
// (어느 단계에서든 실패 → failed)
//
// 호환: 옛 deck 은 outlining/outline-ready 없이 draft → generating 으로 바로 진행.
export type DeckStatus =
  | "draft"
  | "outlining"
  | "outline-ready"
  | "generating"
  | "ready"
  | "failed";

export type Deck = {
  id: string;
  project_id: string;
  title: string;
  status: DeckStatus;
  template_id: string | null;
  provider_id: string | null;
  source_text: string | null;
  source_files_json: string | null;
  created_at: number;
  updated_at: number;
};

export type CreateDeckInput = {
  projectId: string;
  title: string;
  providerId?: string | null;
  sourceText?: string | null;
  sourceFiles?: unknown;
};

export function createDraftDeck(input: CreateDeckInput): Deck {
  const db = getDb();
  const now = Date.now();
  const deck: Deck = {
    id: randomUUID(),
    project_id: input.projectId,
    title: input.title,
    status: "draft",
    template_id: null,
    provider_id: input.providerId ?? null,
    source_text: input.sourceText ?? null,
    source_files_json:
      input.sourceFiles == null ? null : JSON.stringify(input.sourceFiles),
    created_at: now,
    updated_at: now,
  };
  db.prepare(
    `INSERT INTO decks
       (id, project_id, title, status, template_id, provider_id, source_text, source_files_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    deck.id,
    deck.project_id,
    deck.title,
    deck.status,
    deck.template_id,
    deck.provider_id,
    deck.source_text,
    deck.source_files_json,
    deck.created_at,
    deck.updated_at,
  );
  return deck;
}

export function getDeck(id: string): Deck | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM decks WHERE id = ?").get(id) as
    | Deck
    | undefined;
  return row ?? null;
}

export function listAllDecks(): Deck[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM decks ORDER BY created_at DESC")
    .all() as Deck[];
}

export function updateDeck(
  id: string,
  patch: Partial<
    Pick<Deck, "title" | "status" | "template_id" | "provider_id">
  >,
): void {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) {
    fields.push(`${k} = ?`);
    values.push(v);
  }
  if (fields.length === 0) return;
  fields.push("updated_at = ?");
  values.push(Date.now());
  values.push(id);
  db.prepare(`UPDATE decks SET ${fields.join(", ")} WHERE id = ?`).run(
    ...values,
  );
}
