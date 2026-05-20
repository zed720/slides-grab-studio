import fssync from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getDeck, updateDeck } from "@/lib/db/queries/decks";
import { listSlidesByDeck } from "@/lib/db/queries/slides";
import { isBulkEditing } from "@/lib/decks/bulk-edit";
import {
  deriveStage,
  isGenerating,
  plannedSlideTotal,
  syncSlidesFromDisk,
} from "@/lib/decks/generator";
import { deckDir } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  let deck = getDeck(id);
  if (!deck) {
    return NextResponse.json(
      { error: "발표 자료를 찾지 못했어요." },
      { status: 404 },
    );
  }

  const isBulk = isBulkEditing(id);

  // 매 호출마다 디스크 스캔 — AI 가 추가 슬라이드를 만들었을 수도 있으므로
  // status 와 무관하게 항상 sync. (ready 로 너무 일찍 flip 됐어도 새 파일 잡힘.)
  await syncSlidesFromDisk(id);

  // outlining 중인데 디스크에 outline.md 이미 있으면 outline-ready 로 auto-flip.
  // (dev server 재시작 또는 AI process 부모 끊김 등으로 status 업데이트 누락된 케이스 복구.)
  if (deck.status === "outlining") {
    const outlinePath = path.join(deckDir(id), "slide-outline.md");
    if (fssync.existsSync(outlinePath)) {
      updateDeck(id, { status: "outline-ready" });
      deck = getDeck(id) ?? deck;
    }
  }

  if (deck.status === "generating" && !isBulk) {
    // generation 중. 두 케이스 모두 ready 로 flip:
    //   (a) 계획된 분량 도착 — 정상 완료
    //   (b) server 가 더 이상 작업 안 함 (in-memory generating set 에 없음) +
    //       디스크에 슬라이드 1+ 있음 — AI 가 끝났지만 status 업데이트 누락 (예:
    //       dev server restart 또는 AI 가 계획보다 적게 만들고 종료)
    const after = listSlidesByDeck(id);
    const planned = plannedSlideTotal(deck);
    const serverBusy = isGenerating(id);
    if (after.length >= planned) {
      updateDeck(id, { status: "ready" });
      deck = getDeck(id) ?? deck;
    } else if (!serverBusy && after.length > 0) {
      updateDeck(id, { status: "ready" });
      deck = getDeck(id) ?? deck;
    }
  }

  const slides = listSlidesByDeck(id);
  const plannedTotal = plannedSlideTotal(deck);
  const stage = deriveStage(
    id,
    deck.status,
    slides.length,
    plannedTotal,
    isBulk,
  );

  return NextResponse.json(
    {
      deck: {
        id: deck.id,
        title: deck.title,
        status: deck.status,
        template_id: deck.template_id,
        provider_id: deck.provider_id,
      },
      plannedTotal,
      completedCount: slides.length,
      slides: slides.map((s) => ({ idx: s.idx, id: s.id })),
      stage,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
