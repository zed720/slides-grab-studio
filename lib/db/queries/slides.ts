import { randomUUID } from "node:crypto";
import { getDb } from "../index";

export type Slide = {
  id: string;
  deck_id: string;
  idx: number;
  html_path: string;
  created_at: number;
};

export function insertSlide(input: {
  deckId: string;
  idx: number;
  htmlPath: string;
}): Slide {
  const db = getDb();
  const slide: Slide = {
    id: randomUUID(),
    deck_id: input.deckId,
    idx: input.idx,
    html_path: input.htmlPath,
    created_at: Date.now(),
  };
  db.prepare(
    "INSERT INTO slides (id, deck_id, idx, html_path, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(
    slide.id,
    slide.deck_id,
    slide.idx,
    slide.html_path,
    slide.created_at,
  );
  return slide;
}

export function listSlidesByDeck(deckId: string): Slide[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM slides WHERE deck_id = ? ORDER BY idx ASC")
    .all(deckId) as Slide[];
}
