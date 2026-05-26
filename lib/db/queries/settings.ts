import { getDb } from "../index";

// app_settings 테이블 — key-value 전역 설정.
// 현재 키:
//   claude_model — "sonnet" | "opus" | "haiku" | "" (빈 값 = Claude default 따름)

export type ClaudeModelChoice = "" | "sonnet" | "opus" | "haiku";

export const ALLOWED_CLAUDE_MODELS: ClaudeModelChoice[] = [
  "",
  "sonnet",
  "opus",
  "haiku",
];

export function getSetting(key: string): string | null {
  const db = getDb();
  const row = db
    .prepare("SELECT value FROM app_settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  const db = getDb();
  const now = Date.now();
  db.prepare(
    `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(key, value, now);
}

export function getClaudeModel(): ClaudeModelChoice {
  const v = getSetting("claude_model") ?? "";
  if ((ALLOWED_CLAUDE_MODELS as string[]).includes(v)) {
    return v as ClaudeModelChoice;
  }
  return "";
}

export function setClaudeModel(value: ClaudeModelChoice): void {
  setSetting("claude_model", value);
}
