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
          <WelcomeScreen />
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

function WelcomeScreen() {
  return (
    <div className="mx-auto max-w-[880px] px-2 pt-6 pb-20">
      {/* hero */}
      <div className="px-6 pt-12 pb-8 text-center">
        <div className="mb-4 text-[56px] leading-none">🎬</div>
        <h2 className="m-0 mb-3 text-[32px] font-bold tracking-[-0.02em]">
          환영합니다
        </h2>
        <p className="m-0 text-[16px] leading-[1.55] text-[var(--text-muted)]">
          제목과 내용만 알려주시면 AI 가 발표 자료를 만들어 드려요.
          <br />
          모든 데이터는 이 노트북 안에서만 처리돼요.
        </p>
      </div>

      {/* 3 단계 */}
      <div className="my-9 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <Step
          n={1}
          title="내용 올리기"
          desc="제목 + 텍스트 (또는 .md/.pdf/.docx 파일) 만 있으면 충분해요."
        />
        <Step
          n={2}
          title="디자인 고르기"
          desc="35종 디자인 카드 중 분위기에 맞는 걸 클릭."
        />
        <Step
          n={3}
          title="슬라이드 받기"
          desc="AI 가 5~15분간 만든 슬라이드. PDF / PPTX 로 다운로드."
        />
      </div>

      {/* 샘플 빠른 시작 */}
      <div className="mb-7 flex flex-wrap items-center gap-3.5 rounded-[14px] border border-[var(--border)] bg-[var(--surface-2)] px-5 py-4">
        <span className="flex-shrink-0 text-[22px]">💡</span>
        <span className="flex-1 min-w-[200px] text-[13.5px]">
          <b className="font-bold">처음이라 막막하시면</b> — 미리 준비된 샘플로 한 번 만들어 보세요.
        </span>
        <span className="flex flex-shrink-0 gap-2">
          <Link
            href="/start?sample=team-retro"
            className="inline-flex items-center gap-1.5 rounded-[10px] border-[1.5px] border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12.5px] font-semibold text-[var(--text)] no-underline hover:border-[var(--primary)] hover:bg-[var(--surface-2)] hover:no-underline"
          >
            📄 팀 회고 샘플
          </Link>
          <Link
            href="/start?sample=onboarding"
            className="inline-flex items-center gap-1.5 rounded-[10px] border-[1.5px] border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12.5px] font-semibold text-[var(--text)] no-underline hover:border-[var(--primary)] hover:bg-[var(--surface-2)] hover:no-underline"
          >
            📄 신입 온보딩 샘플
          </Link>
        </span>
      </div>

      {/* 큰 CTA */}
      <div className="flex justify-center">
        <Link
          href="/start"
          className="inline-flex items-center gap-2.5 rounded-[14px] bg-[var(--primary)] px-9 py-4 text-[17px] font-bold tracking-[-0.005em] text-[var(--primary-foreground)] no-underline hover:bg-[var(--primary-hover)] hover:no-underline"
        >
          + 첫 발표 자료 만들기
        </Link>
      </div>

      {/* footer */}
      <div className="mt-14 flex flex-wrap justify-center gap-7 border-t border-[var(--border)] pt-6 text-[12.5px] text-[var(--text-muted)]">
        <span>
          📂 만든 자료는 앱 폴더 안{" "}
          <code className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[11.5px]">
            data/decks
          </code>{" "}
          에 저장돼요.
        </span>
      </div>
    </div>
  );
}

function Step({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-[14px] border-[1.5px] border-[var(--border)] bg-[var(--surface)] px-[18px] py-[22px]">
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-2.5 py-[3px] text-[11.5px] font-bold tracking-[0.02em] text-[var(--accent)]">
        {n}
      </span>
      <span className="text-[15px] font-bold tracking-[-0.005em]">{title}</span>
      <span className="text-[12.5px] leading-[1.5] text-[var(--text-muted)]">
        {desc}
      </span>
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
