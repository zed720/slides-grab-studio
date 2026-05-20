import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { migrations } from "./migrations";

type Db = Database.Database;

const globalForDb = globalThis as unknown as { __slidesGrabDb?: Db };

export function getDb(): Db {
  if (globalForDb.__slidesGrabDb) return globalForDb.__slidesGrabDb;

  const dataDir = path.resolve(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, "app.db");

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  applyMigrations(db);
  cleanupStaleGeneration(db);

  globalForDb.__slidesGrabDb = db;
  return db;
}

// 서버 부팅 직후 — 이전 프로세스가 도중에 죽으면서 DB 에 'generating' / 'outlining'
// 상태로 박혀 있는 deck 이 있을 수 있다. 현재 프로세스의 in-memory 작업 큐는
// 비어 있으므로 진행할 방법이 없다. 사용자가 다시 시도할 수 있도록 'failed' 로 정리.
// 이미 만들어진 슬라이드 파일은 그대로 디스크에 남아있으므로 라이브러리에서 다시 열 수 있다.
function cleanupStaleGeneration(db: Db): void {
  const res = db
    .prepare(
      "UPDATE decks SET status = 'failed', updated_at = ? WHERE status IN ('generating', 'outlining')",
    )
    .run(Date.now());
  if (res.changes > 0) {
    console.log(
      `[db] 이전 세션에서 멈춘 작업 ${res.changes}개를 '실패' 로 정리했어요.`,
    );
  }
}

function applyMigrations(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `);

  const appliedRows = db
    .prepare("SELECT version FROM schema_migrations")
    .all() as { version: number }[];
  const applied = new Set(appliedRows.map((r) => r.version));

  const insert = db.prepare(
    "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
  );

  for (const m of migrations) {
    if (applied.has(m.version)) continue;
    db.transaction(() => {
      db.exec(m.sql);
      insert.run(m.version, m.name, Date.now());
    })();
  }
}
