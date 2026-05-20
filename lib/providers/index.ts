import { claudeCode } from "./claude-code";
import { codex } from "./codex";
import type { Provider, ProviderStatus } from "./provider";

export const providers: Provider[] = [claudeCode, codex];

export async function detectAll(): Promise<ProviderStatus[]> {
  return Promise.all(providers.map((p) => p.detect()));
}

export type { Provider, ProviderId, ProviderStatus } from "./provider";
