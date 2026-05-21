"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ScaledSlideFrame } from "@/components/ScaledSlideFrame";
import { TopNav } from "@/components/TopNav";

type DeckStatus =
  | "draft"
  | "outlining"
  | "outline-ready"
  | "generating"
  | "ready"
  | "failed";

type TrashItem = {
  id: string;
  title: string;
  status: DeckStatus;
  plannedTotal: number;
  completedCount: number;
  createdAt: number;
  updatedAt: number;
  deletedAt: number;
};

type FetchState =
  | { kind: "loading" }
  | { kind: "ok"; decks: TrashItem[] }
  | { kind: "error"; message: string };

type PendingDestroy = { id: string; title: string } | null;

export default function TrashPage() {
  const [state, setState] = useState<FetchState>({ kind: "loading" });
  const [pendingDestroy, setPendingDestroy] = useState<PendingDestroy>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null); // 진행 중 deck id

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/decks/trash", { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "휴지통을 불러오지 못했어요.");
      }
      const data = (await res.json()) as { decks: TrashItem[] };
      setState({ kind: "ok", decks: data.decks });
    } catch (err) {
      setState({
        kind: "error",
        message:
          err instanceof Error ? err.message : "휴지통을 불러오지 못했어요.",
      });
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const restore = useCallback(
    async (id: string) => {
      setSubmitting(id);
      setActionError(null);
      try {
        const res = await fetch(`/api/decks/${id}/restore`, { method: "POST" });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error ?? "복원하지 못했어요.");
        }
        await load();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "복원하지 못했어요.");
      } finally {
        setSubmitting(null);
      }
    },
    [load],
  );

  const destroyForReal = useCallback(async () => {
    if (!pendingDestroy) return;
    setSubmitting(pendingDestroy.id);
    setActionError(null);
    try {
      const res = await fetch(`/api/decks/${pendingDestroy.id}/permanent`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "영구 삭제하지 못했어요.");
      }
      setPendingDestroy(null);
      await load();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "영구 삭제하지 못했어요.",
      );
    } finally {
      setSubmitting(null);
    }
  }, [pendingDestroy, load]);

  return (
    <>
      <TopNav />
      <main className="mx-auto w-full max-w-[1600px] px-8 pt-10 pb-20">
        <div className="mb-2 flex items-end justify-between gap-4">
          <h1 className="m-0 inline-flex items-center gap-2.5 text-[28px] font-bold tracking-[-0.02em]">
            🗑️ 휴지통
          </h1>
          <div className="flex items-center gap-3 text-[13px] text-[var(--text-muted)]">
            {state.kind === "ok" ? (
              <span>
                전체 <b className="text-[var(--text)]">{state.decks.length}</b>개
              </span>
            ) : null}
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--text)] no-underline hover:bg-[var(--surface-2)] hover:no-underline"
            >
              ← 내 발표 자료로
            </Link>
          </div>
        </div>
        <p className="m-0 mb-7 text-[13.5px] text-[var(--text-muted)]">
          여기서 <b className="text-[var(--text)]">복원</b>하면 라이브러리로 돌아가요.
          <b className="text-[var(--text)]"> 영구 삭제</b>는 한 번 더 확인 후 폴더가 완전히 사라집니다.
        </p>

        {actionError ? (
          <div className="mb-4 rounded-[10px] border border-[rgba(239,68,68,0.25)] bg-[var(--danger-soft)] px-4 py-3 text-[13px] font-semibold text-[var(--danger)]">
            {actionError}
          </div>
        ) : null}

        {state.kind === "loading" ? (
          <LoadingGrid />
        ) : state.kind === "error" ? (
          <ErrorBox message={state.message} />
        ) : state.decks.length === 0 ? (
          <EmptyTrash />
        ) : (
          <div
            className="grid gap-5"
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            }}
          >
            {state.decks.map((d) => (
              <TrashCard
                key={d.id}
                deck={d}
                disabled={submitting !== null}
                onRestore={() => restore(d.id)}
                onDestroy={() =>
                  setPendingDestroy({ id: d.id, title: d.title })
                }
              />
            ))}
          </div>
        )}
      </main>

      {pendingDestroy ? (
        <DestroyDialog
          title={pendingDestroy.title}
          submitting={submitting === pendingDestroy.id}
          onCancel={() => {
            if (submitting) return;
            setPendingDestroy(null);
            setActionError(null);
          }}
          onConfirm={destroyForReal}
        />
      ) : null}
    </>
  );
}

function TrashCard({
  deck,
  disabled,
  onRestore,
  onDestroy,
}: {
  deck: TrashItem;
  disabled: boolean;
  onRestore: () => void;
  onDestroy: () => void;
}) {
  const isReady = deck.status === "ready" && deck.completedCount > 0;
  return (
    <div className="flex flex-col overflow-hidden rounded-[14px] border-[1.5px] border-[var(--border)] bg-[var(--surface-2)] opacity-90">
      <div className="relative aspect-video overflow-hidden bg-white" style={{ filter: "grayscale(0.4)" }}>
        {isReady ? (
          <ScaledSlideFrame
            title={deck.title}
            src={`/api/decks/${deck.id}/slides/0`}
            lazy
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[var(--surface-2)] text-[12px] text-[var(--text-muted)]">
            미리보기 없음
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-white/30 text-[22px]">
          🗑️
        </div>
      </div>
      <div className="border-t border-[var(--border)] px-3.5 py-3">
        <div className="truncate text-[14.5px] font-bold tracking-[-0.01em] text-[var(--text)]">
          {deck.title}
        </div>
        <div className="text-[11.5px] text-[var(--text-muted)]">
          {deck.completedCount}장 · {formatDate(deck.deletedAt)} 삭제
        </div>
      </div>
      <div className="flex gap-1.5 px-3.5 pb-3.5">
        <button
          type="button"
          onClick={onRestore}
          disabled={disabled}
          className="flex-1 rounded-[9px] border-[1.5px] border-[var(--accent)] bg-[var(--surface)] px-2 py-2 text-[12.5px] font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:opacity-50"
        >
          ↩ 복원
        </button>
        <button
          type="button"
          onClick={onDestroy}
          disabled={disabled}
          className="rounded-[9px] border-[1.5px] border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12.5px] font-medium text-[var(--text-muted)] hover:border-[var(--danger)] hover:text-[var(--danger)] disabled:opacity-50"
        >
          영구 삭제
        </button>
      </div>
    </div>
  );
}

function DestroyDialog({
  title,
  submitting,
  onCancel,
  onConfirm,
}: {
  title: string;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-6 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="flex w-full max-w-[460px] flex-col overflow-hidden rounded-[16px] bg-[var(--surface)] shadow-[var(--shadow-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-7 pb-5 text-center">
          <div className="mb-3 text-[40px] leading-none">⚠️</div>
          <div className="mb-2 text-[18px] font-bold tracking-[-0.01em]">
            ‘{title}’ 을 완전히 지울까요?
          </div>
          <p className="m-0 text-[13.5px] leading-[1.55] text-[var(--text-muted)]">
            발표 자료 폴더가 디스크에서 <b className="text-[var(--danger)]">완전히 사라집니다</b>. 이 동작은 되돌릴 수 없어요.
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-3.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-[10px] border border-[var(--border)] bg-transparent px-4 py-2 text-[13.5px] font-medium text-[var(--text)] hover:bg-[var(--surface-2)] disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="rounded-[10px] border border-[var(--danger)] bg-[var(--danger)] px-4 py-2 text-[13.5px] font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? "지우는 중…" : "완전히 지우기"}
          </button>
        </div>
      </div>
    </div>
  );
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
      {[0, 1].map((i) => (
        <div
          key={i}
          className="flex animate-pulse flex-col overflow-hidden rounded-[14px] border-[1.5px] border-[var(--border)] bg-[var(--surface-2)]"
        >
          <div className="aspect-video bg-[var(--surface-2)]" />
          <div className="border-t border-[var(--border)] px-3.5 py-3">
            <div className="mb-2 h-4 w-32 rounded bg-[var(--border)]" />
            <div className="h-3 w-20 rounded bg-[var(--border)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyTrash() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[16px] border border-[var(--border)] bg-[var(--surface)] py-20 text-center">
      <div className="text-[36px]">🗑️</div>
      <div className="text-[15px] font-semibold">휴지통이 비어있어요</div>
      <div className="text-[13px] text-[var(--text-muted)]">
        라이브러리 카드 왼쪽 위 ✕ 버튼으로 자료를 휴지통으로 보낼 수 있어요.
      </div>
      <Link
        href="/"
        className="mt-2 inline-flex items-center gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[13.5px] font-semibold text-[var(--text)] no-underline hover:bg-[var(--surface-2)] hover:no-underline"
      >
        ← 내 발표 자료로
      </Link>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-[16px] border border-[rgba(239,68,68,0.25)] bg-[var(--danger-soft)] p-6 text-[14px] text-[var(--danger)]">
      <div className="font-semibold">휴지통을 불러오지 못했어요</div>
      <div className="text-[var(--text-muted)]">{message}</div>
    </div>
  );
}
