import { getDb } from "../index";

export type CachedProviderStatus = {
  provider_id: string;
  installed: number;
  version: string | null;
  checked_at: number;
};

export function getCachedStatus(
  providerId: string,
): CachedProviderStatus | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM provider_status_cache WHERE provider_id = ?")
    .get(providerId) as CachedProviderStatus | undefined;
  return row ?? null;
}

export function upsertCachedStatus(input: {
  providerId: string;
  installed: boolean;
  version: string | null;
}): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO provider_status_cache (provider_id, installed, version, checked_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (provider_id) DO UPDATE SET
       installed = excluded.installed,
       version = excluded.version,
       checked_at = excluded.checked_at`,
  ).run(input.providerId, input.installed ? 1 : 0, input.version, Date.now());
}
