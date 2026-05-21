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
  // Phase 2 휴지통 — NULL = 살아있음, 숫자 = 삭제된 시각 (ms epoch).
  // 라이브러리는 deleted_at IS NULL, 휴지통은 deleted_at IS NOT NULL.
  deleted_at: number | null;
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
    deleted_at: null,
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

// 휴지통 안 deck 도 가져옴 — API 호출 시 deck 이 존재하는지 자체는 확인할 수 있어야 (예: 복원).
export function getDeck(id: string): Deck | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM decks WHERE id = ?").get(id) as
    | Deck
    | undefined;
  return row ?? null;
}

// 라이브러리용 — 살아있는 deck 만.
export function listAllDecks(): Deck[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM decks WHERE deleted_at IS NULL ORDER BY created_at DESC")
    .all() as Deck[];
}

// 휴지통용 — 삭제된 deck 만, 가장 최근에 삭제된 게 먼저.
export function listTrashedDecks(): Deck[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM decks WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC",
    )
    .all() as Deck[];
}

export function countTrashedDecks(): number {
  const db = getDb();
  const row = db
    .prepare("SELECT COUNT(*) AS n FROM decks WHERE deleted_at IS NOT NULL")
    .get() as { n: number };
  return row.n;
}

// soft delete — 행은 유지, deleted_at 만 표시. data/decks/<id>/ 폴더는 그대로 둠 (복원 가능).
export function softDeleteDeck(id: string): void {
  const db = getDb();
  const now = Date.now();
  db.prepare(
    "UPDATE decks SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
  ).run(now, now, id);
}

export function restoreDeck(id: string): void {
  const db = getDb();
  const now = Date.now();
  db.prepare(
    "UPDATE decks SET deleted_at = NULL, updated_at = ? WHERE id = ? AND deleted_at IS NOT NULL",
  ).run(now, id);
}

// 영구 삭제 — DB 행 삭제. 디스크 폴더 제거는 호출하는 쪽에서 따로 처리.
export function permanentDeleteDeck(id: string): void {
  const db = getDb();
  db.prepare("DELETE FROM decks WHERE id = ?").run(id);
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
