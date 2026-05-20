"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { QuickExport } from "@/components/QuickExport";
import { ScaledSlideFrame } from "@/components/ScaledSlideFrame";
import { TopNav } from "@/components/TopNav";

type DeckStatus =
  | "draft"
  | "outlining"
  | "outline-ready"
  | "generating"
  | "ready"
  | "failed";

type DeckListItem = {
  id: string;
  title: string;
  status: DeckStatus;
  plannedTotal: number;
  completedCount: number;
  createdAt: number;
  updatedAt: number;
};

type FetchState =
  | { kind: "loading" }
  | { kind: "ok"; decks: DeckListItem[] }
  | { kind: "error"; message: string };

export default function LibraryPage() {
  const [state, setState] = useState<FetchState>({ kind: "loading" });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/decks", { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { decks: DeckListItem[] };
      setState({ kind: "ok", decks: data.decks });
    } catch (err) {
      setState({
        kind: "error",
        message:
          err instanceof Error ? err.message : "목록을 불러오지 못했어요.",
      });
    }
  }, []);

  useEffect(() => {
    // mount 시 1회 fetch — load 는 useCallback([]) 이라 사실상 한 번만 실행
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return (
    <>
      <TopNav />
      <main className="mx-auto w-full max-w-[1600px] px-8 pt-10 pb-20">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h1 className="m-0 text-[28px] font-bold tracking-[-0.02em]">
            내 발표 자료
          </h1>
          <div className="flex items-center gap-3 text-[13px] text-[var(--text-muted)]">
            {state.kind === "ok" ? (
              <span>
                전체 <b className="text-[var(--text)]">{state.decks.length}</b>개
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setState({ kind: "loading" });
                load();
              }}
              className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[12.5px] font-medium hover:bg-[var(--surface-2)]"
            >
              새로고침
            </button>
          </div>
        </div>

        {state.kind === "loading" ? (
          <LoadingGrid />
        ) : state.kind === "error" ? (
          <ErrorBox message={state.message} />
        ) : state.decks.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div
              className="grid gap-5"
              style={{
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              }}
            >
              <NewDeckCard />
              {state.decks.map((d) => (
                <DeckCard key={d.id} deck={d} />
              ))}
            </div>
            <p className="mt-10 text-center text-[12.5px] text-[var(--text-muted)]">
              발표 자료를 지우려면 앱 폴더 안{" "}
              <code className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[11.5px]">
                data/decks
              </code>{" "}
              에서 해당 폴더를 삭제해 주세요.
            </p>
          </>
        )}
      </main>
    </>
  );
}

function NewDeckCard() {
  return (
    <Link
      href="/start"
      className="group flex aspect-[5/4] flex-col items-center justify-center gap-3 rounded-[14px] border-2 border-dashed border-[var(--border-strong)] bg-[var(--surface-2)] p-6 text-center no-underline transition-all hover:-translate-y-0.5 hover:border-[var(--primary)] hover:bg-[var(--surface)] hover:no-underline hover:shadow-[var(--shadow-md)]"
    >
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[28px] font-bold text-[var(--text)] group-hover:border-[var(--primary)] group-hover:text-[var(--primary)]">
        +
      </div>
      <div className="text-[15px] font-bold text-[var(--text)]">
        새 발표 자료 만들기
      </div>
      <div className="text-[12.5px] text-[var(--text-muted)]">
        제목과 내용만 알려주시면 AI 가 만들어줘요
      </div>
    </Link>
  );
}

function DeckCard({ deck }: { deck: DeckListItem }) {
  const isReady = deck.status === "ready" && deck.completedCount > 0;
  // Link 를 wrapper 안에 두고 ⬇ 빠른 다운로드 버튼은 그 형제로 (Link 안 button = invalid HTML).
  // wrapper 가 hover/transition 담당, Link 는 본체 클릭만.
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-[14px] border-2 border-[var(--border)] bg-[var(--surface)] transition-all hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-md)]">
      <Link
        href={`/deck/${deck.id}`}
        className="contents text-inherit no-underline hover:no-underline"
      >
        <div className="relative aspect-video overflow-hidden bg-white">
          {isReady ? (
            <ScaledSlideFrame
              title={deck.title}
              src={`/api/decks/${deck.id}/slides/0`}
              lazy
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[var(--surface-2)]">
              <StatusBadge status={deck.status} />
            </div>
          )}
          {isReady ? (
            <StatusBadge
              status={deck.status}
              className="absolute right-2 top-2"
            />
          ) : null}
        </div>
        <div className="flex flex-1 flex-col gap-1 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3.5">
          <div className="truncate text-[15px] font-bold tracking-[-0.01em] text-[var(--text)]">
            {deck.title}
          </div>
          <div className="text-[12.5px] text-[var(--text-muted)]">
            {deckMeta(deck)}
          </div>
        </div>
      </Link>
      {isReady ? <QuickExport deckId={deck.id} /> : null}
    </div>
  );
}

function StatusBadge({
  status,
  className,
}: {
  status: DeckStatus;
  className?: string;
}) {
  const label =
    status === "ready"
      ? "완성"
      : status === "generating"
        ? "만드는 중"
        : status === "outlining"
          ? "구조 잡는 중"
          : status === "outline-ready"
            ? "확인 필요"
            : status === "failed"
              ? "실패"
              : "시작 전";

  const tone =
    status === "ready"
      ? "border border-[rgba(16,185,129,0.25)] bg-[var(--success-soft)] text-[var(--success)]"
      : status === "generating" || status === "outlining"
        ? "border border-[#dbeafe] bg-[var(--accent-soft)] text-[var(--accent)]"
        : status === "outline-ready"
          ? "border border-[#fde68a] bg-[#fef3c7] text-[#92400e]"
          : status === "failed"
            ? "border border-[rgba(239,68,68,0.25)] bg-[var(--danger-soft)] text-[var(--danger)]"
            : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)]";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone} ${className ?? ""}`}
    >
      {label}
    </span>
  );
}

function deckMeta(d: DeckListItem): string {
  const date = formatDate(d.createdAt);
  if (d.status === "ready") {
    return `${d.completedCount}장 · ${date}`;
  }
  if (d.status === "generating") {
    return `${d.completedCount} / ${d.plannedTotal}장 · ${date}`;
  }
  if (d.status === "failed") {
    return `실패 · ${date}`;
  }
  return date;
}

function formatDate(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  const isSameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (isSameDay) {
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    return `오늘 ${h}:${m}`;
  }
  if (d.getFullYear() === now.getFullYear()) {
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  }
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}`;
}

function LoadingGrid() {
  return (
    <div
      className="grid gap-5"
      style={{
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
      }}
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex animate-pulse flex-col overflow-hidden rounded-[14px] border-2 border-[var(--border)] bg-[var(--surface)]"
        >
          <div className="aspect-video bg-[var(--surface-2)]" />
          <div className="border-t border-[var(--border)] px-4 py-3.5">
            <div className="mb-2 h-4 w-32 rounded bg-[var(--border)]" />
            <div className="h-3 w-20 rounded bg-[var(--border)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-6 rounded-[16px] border border-[var(--border)] bg-[var(--surface)] py-20 text-center">
      <div className="text-[15px] font-semibold">
        아직 만든 발표 자료가 없어요
      </div>
      <div className="text-[13.5px] text-[var(--text-muted)]">
        오른쪽 버튼을 눌러 첫 발표를 만들어 봐요.
      </div>
      <Link
        href="/start"
        className="inline-flex items-center gap-2 rounded-[12px] border border-[var(--primary)] bg-[var(--primary)] px-7 py-4 text-[16px] font-semibold text-[var(--primary-foreground)] no-underline hover:bg-[var(--primary-hover)] hover:no-underline"
      >
        + 새 발표 자료 만들기
      </Link>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-[16px] border border-[rgba(239,68,68,0.25)] bg-[var(--danger-soft)] p-6 text-[14px] text-[var(--danger)]">
      <div className="font-semibold">목록을 불러오지 못했어요</div>
      <div className="text-[var(--text-muted)]">{message}</div>
    </div>
  );
}
