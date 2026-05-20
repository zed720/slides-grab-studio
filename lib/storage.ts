import fs from "node:fs";
import path from "node:path";

export function dataRoot(): string {
  return path.resolve(process.cwd(), "data");
}

export function deckDir(deckId: string): string {
  return path.join(dataRoot(), "decks", deckId);
}

export function deckUploadsDir(deckId: string): string {
  return path.join(deckDir(deckId), "uploads");
}

export function deckOutputDir(deckId: string): string {
  return path.join(deckDir(deckId), "output");
}

export function ensureDir(p: string): string {
  fs.mkdirSync(p, { recursive: true });
  return p;
}
