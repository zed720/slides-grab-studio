export type Migration = {
  version: number;
  name: string;
  sql: string;
};

export const migrations: Migration[] = [
  {
    version: 1,
    name: "initial",
    sql: `
      CREATE TABLE projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE decks (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('draft','generating','ready','failed')),
        template_id TEXT,
        provider_id TEXT,
        source_text TEXT,
        source_files_json TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX idx_decks_project ON decks(project_id);

      CREATE TABLE slides (
        id TEXT PRIMARY KEY,
        deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
        idx INTEGER NOT NULL,
        html_path TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        UNIQUE (deck_id, idx)
      );
      CREATE INDEX idx_slides_deck ON slides(deck_id);

      CREATE TABLE provider_status_cache (
        provider_id TEXT PRIMARY KEY,
        installed INTEGER NOT NULL,
        version TEXT,
        checked_at INTEGER NOT NULL
      );
    `,
  },
  {
    version: 2,
    name: "decks_status_add_outlining_states",
    // CHECK 제약 확장 — 새 outline 검토 흐름의 'outlining' / 'outline-ready' 허용.
    // SQLite 는 CHECK 직접 변경 안 되니 table swap.
    sql: `
      PRAGMA foreign_keys = OFF;

      CREATE TABLE decks_new (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('draft','outlining','outline-ready','generating','ready','failed')),
        template_id TEXT,
        provider_id TEXT,
        source_text TEXT,
        source_files_json TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      INSERT INTO decks_new
        (id, project_id, title, status, template_id, provider_id, source_text, source_files_json, created_at, updated_at)
        SELECT id, project_id, title, status, template_id, provider_id, source_text, source_files_json, created_at, updated_at
        FROM decks;

      DROP TABLE decks;
      ALTER TABLE decks_new RENAME TO decks;

      CREATE INDEX idx_decks_project ON decks(project_id);

      PRAGMA foreign_keys = ON;
    `,
  },
];
