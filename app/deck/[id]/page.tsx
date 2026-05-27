"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ExportModal,
  type ExportFormat,
  type ExportPhase,
} from "@/components/ExportModal";
import { ScaledSlideFrame } from "@/components/ScaledSlideFrame";
import { TopNav } from "@/components/TopNav";

type DeckStatus =
  | "draft"
  | "outlining"
  | "outline-ready"
  | "generating"
  | "ready"
  | "failed";

type DeckStage =
  | "planning"
  | "designing"
  | "finalizing"
  | "bulk-editing"
  | "ready"
  | "failed";

type StatusResponse = {
  deck: {
    id: string;
    title: string;
    status: DeckStatus;
    template_id: string | null;
    provider_id: string | null;
  };
  plannedTotal: number;
  completedCount: number;
  slides: { idx: number; id: string }[];
  stage: DeckStage;
};

type FetchState =
  | { kind: "loading" }
  | { kind: "ok"; data: StatusResponse }
  | { kind: "error"; message: string };

type EditState =
  | { kind: "preview" }
  | { kind: "starting" }
  | { kind: "active"; url: string }
  | { kind: "error"; message: string };

const POLL_INTERVAL_MS = 1000;

export default function DeckPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const deckId = params.id;
  const providerId = searchParams.get("provider") ?? "";

  const [state, setState] = useState<FetchState>({ kind: "loading" });
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [editState, setEditState] = useState<EditState>({ kind: "preview" });
  const [previewBust, setPreviewBust] = useState<number>(0);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [exportPhase, setExportPhase] = useState<ExportPhase>({ kind: "idle" });
  const [exportModalOpen, setExportModalOpen] = useState(false);
  // 이어 만들기 (v0.3.1) — failed deck 에서 N+1 장부터 만들기
  const [resuming, setResuming] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  // 발표 구조 보기 (v0.3.2) — outline.md 모달
  const [outlineModalOpen, setOutlineModalOpen] = useState(false);
  const [outlineContent, setOutlineContent] = useState<string | null>(null);
  const [outlineError, setOutlineError] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState(false);
  const autoFollowRef = useRef(true);
  const editStateRef = useRef<EditState>(editState);
  useEffect(() => {
    editStateRef.current = editState;
  }, [editState]);
  const prevStageRef = useRef<DeckStage | null>(null);

  const fetchStatus = useCallback(async (): Promise<StatusResponse | null> => {
    try {
      const res = await fetch(`/api/decks/${deckId}/status`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      return (await res.json()) as StatusResponse;
    } catch (err) {
      setState({
        kind: "error",
        message:
          err instanceof Error ? err.message : "상태를 확인하지 못했어요.",
      });
      return null;
    }
  }, [deckId]);


  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const loop = async () => {
      if (cancelled) return;
      // 탭이 숨겨져 있으면 폴링 일시 중단 — 다시 보일 때 visibilitychange 에서 재개
      if (typeof document !== "undefined" && document.hidden) {
        timer = setTimeout(loop, POLL_INTERVAL_MS);
        return;
      }
      const data = await fetchStatus();
      if (cancelled || !data) return;

      setState({ kind: "ok", data });

      // 새 흐름:
      //   draft + 디자인 안 골랐음 → /templates (디자인 선택부터)
      //   draft + 디자인 골랐음 / outlining / outline-ready → /outline
      if (data.deck.status === "draft" && !data.deck.template_id) {
        const qs = new URLSearchParams({ deck: deckId });
        if (providerId) qs.set("provider", providerId);
        router.replace(`/templates?${qs.toString()}`);
        return;
      }
      if (
        data.deck.status === "draft" ||
        data.deck.status === "outlining" ||
        data.deck.status === "outline-ready"
      ) {
        const qs = providerId ? `?provider=${providerId}` : "";
        router.replace(`/outline/${deckId}${qs}`);
        return;
      }

      if (autoFollowRef.current && data.slides.length > 0) {
        const latest = data.slides[data.slides.length - 1].idx;
        setSelectedIdx((prev) => (prev === latest ? prev : latest));
      }

      // bulk-edit 가 끝나면 (stage 가 bulk-editing → ready/failed) 미리보기 cache-bust
      const prev = prevStageRef.current;
      if (prev === "bulk-editing" && data.stage !== "bulk-editing") {
        setPreviewBust((n) => n + 1);
      }
      prevStageRef.current = data.stage;

      if (
        data.deck.status === "generating" ||
        data.stage === "bulk-editing"
      ) {
        timer = setTimeout(loop, POLL_INTERVAL_MS);
      }
    };

    const onVisible = () => {
      if (!document.hidden && !cancelled) {
        // 탭으로 돌아왔으면 기존 timer 취소하고 즉시 한 번 더 fetch
        if (timer) clearTimeout(timer);
        loop();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    loop();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // refreshSignal 이 바뀌면 폴링 즉시 재시작 (bulk-edit 시작 직후처럼 즉시 갱신 필요한 케이스)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchStatus, refreshSignal]);

  // 내보내기 polling — running 상태일 때만 활성. 모달이 닫혀도 계속 따라간다
  // (mockup 동작 메모: "모달 닫아도 백그라운드에서 계속 진행").
  useEffect(() => {
    if (exportPhase.kind !== "running") return;
    const jobId = exportPhase.jobId;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(
          `/api/decks/${deckId}/export/${jobId}`,
          { cache: "no-store" },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          status: "running" | "done" | "failed";
          format: ExportFormat;
          filename: string;
          sizeBytes: number | null;
          error: string | null;
          downloadUrl: string | null;
        };
        if (cancelled) return;
        if (data.status === "done" && data.downloadUrl) {
          setExportPhase({
            kind: "done",
            jobId,
            format: data.format,
            filename: data.filename,
            sizeBytes: data.sizeBytes ?? 0,
            downloadUrl: data.downloadUrl,
          });
        } else if (data.status === "failed") {
          setExportPhase({
            kind: "failed",
            format: data.format,
            error: data.error ?? "내보내기에 실패했어요.",
          });
        } else {
          timer = setTimeout(tick, 1000);
        }
      } catch {
        if (cancelled) return;
        // 일시적 fetch 에러는 한 박자 쉬고 재시도 (서버 reload 등)
        timer = setTimeout(tick, 1500);
      }
    };
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [exportPhase, deckId]);

  // 페이지 떠날 때 에디터 정리
  useEffect(() => {
    return () => {
      if (editStateRef.current.kind === "active" || editStateRef.current.kind === "starting") {
        // fire-and-forget (페이지가 사라지는 중이므로 응답 기다릴 의미 없음)
        try {
          fetch(`/api/decks/${deckId}/edit/stop`, {
            method: "POST",
            keepalive: true,
          });
        } catch {}
      }
    };
  }, [deckId]);

  const onPickSlide = (idx: number) => {
    autoFollowRef.current = false;
    setSelectedIdx(idx);
  };

  // ←/→ 방향키로 슬라이드 이동. modal 열림 / input focus / 수정 모드 시 무시.
  useEffect(() => {
    if (state.kind !== "ok") return;
    const completedIdxs = new Set(state.data.slides.map((s) => s.idx));
    const total = state.data.plannedTotal;
    const onKey = (e: KeyboardEvent) => {
      // ↓/→ 다음, ↑/← 이전. 좌측 썸네일은 세로 (↑↓), 가운데 미리보기는 가로 (←→) — 둘 다 일관.
      const isNext = e.key === "ArrowRight" || e.key === "ArrowDown";
      const isPrev = e.key === "ArrowLeft" || e.key === "ArrowUp";
      if (!isNext && !isPrev) return;
      // input/textarea/contentEditable focus 시 그쪽으로 양보
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      )
        return;
      // modal / 수정 모드 활성 시 양보
      if (bulkModalOpen || exportModalOpen) return;
      if (editState.kind === "active" || editState.kind === "starting") return;

      e.preventDefault();
      autoFollowRef.current = false;
      if (isNext) {
        const next = findNext(completedIdxs, selectedIdx, total);
        if (next !== null) setSelectedIdx(next);
      } else {
        const prev = findPrev(completedIdxs, selectedIdx);
        if (prev !== null) setSelectedIdx(prev);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [state, selectedIdx, bulkModalOpen, exportModalOpen, editState]);

  const enterEditMode = useCallback(async () => {
    setEditState({ kind: "starting" });
    try {
      const res = await fetch(`/api/decks/${deckId}/edit/start`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { url: string };
      setEditState({ kind: "active", url: data.url });
    } catch (err) {
      setEditState({
        kind: "error",
        message:
          err instanceof Error
            ? err.message
            : "수정 도구를 켜지 못했어요.",
      });
    }
  }, [deckId]);

  const exitEditMode = useCallback(async () => {
    setEditState({ kind: "preview" });
    setPreviewBust((n) => n + 1);
    try {
      await fetch(`/api/decks/${deckId}/edit/stop`, { method: "POST" });
    } catch {}
  }, [deckId]);

  if (state.kind === "loading") {
    return (
      <Shell>
        <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-6 text-[14px] text-[var(--text-muted)]">
          상태 확인 중…
        </div>
      </Shell>
    );
  }
  if (state.kind === "error") {
    return (
      <Shell>
        <div className="m-6 flex flex-col gap-3 rounded-[14px] border border-[rgba(239,68,68,0.25)] bg-[var(--danger-soft)] p-6 text-[14px] text-[var(--danger)]">
          <div className="font-semibold">발표 자료를 열지 못했어요</div>
          <div className="text-[var(--text-muted)]">{state.message}</div>
          <div className="mt-2 flex gap-2">
            <Link
              href="/"
              className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[13.5px] font-semibold text-[var(--text)] no-underline hover:bg-[var(--surface-2)] hover:no-underline"
            >
              ← 내 발표 자료
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  const { data } = state;
  const completedSet = new Set(data.slides.map((s) => s.idx));
  const completedCount = data.completedCount;
  const total = data.plannedTotal;
  const pct = Math.min(100, Math.round((completedCount / total) * 100));
  const status = data.deck.status;
  const editingEnabled =
    completedCount > 0 &&
    (status === "ready" || completedCount >= total) &&
    data.stage !== "bulk-editing";
  const isEditingPage =
    editState.kind === "active" || editState.kind === "starting";

  return (
    <Shell>
      <div className="flex flex-shrink-0 flex-col gap-3 px-4 pt-3">
        {isEditingPage ? null : (
          <MakingBar
            stage={data.stage}
            pct={pct}
            completed={completedCount}
            total={total}
          />
        )}
        {status === "failed" ? (
          <div className="flex flex-col gap-2 rounded-[12px] border border-[rgba(239,68,68,0.25)] bg-[var(--danger-soft)] px-4 py-3 text-[13.5px] text-[var(--danger)]">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold">
                슬라이드 만들기 도중 멈췄어요.
              </span>
              {completedCount > 0 ? (
                <span className="text-[var(--text-muted)]">
                  이미 <b className="text-[var(--text)]">{completedCount}장</b>
                  {" "}만들어졌어요 — AI 가 {completedCount + 1}장부터 이어서
                  만들 수 있어요 (토큰 절약).
                </span>
              ) : (
                <span className="text-[var(--text-muted)]">
                  한 장도 못 만들었어요. 디자인 단계로 돌아가서 다시 시작해 주세요.
                </span>
              )}
              <div className="flex-1" />
              {completedCount > 0 ? (
                <button
                  type="button"
                  disabled={resuming}
                  onClick={async () => {
                    setResumeError(null);
                    setResuming(true);
                    try {
                      const res = await fetch(
                        `/api/decks/${deckId}/resume`,
                        { method: "POST" },
                      );
                      const data = (await res.json().catch(() => null)) as {
                        started?: boolean;
                        error?: string;
                      } | null;
                      if (!res.ok || !data?.started) {
                        throw new Error(
                          data?.error ?? `요청 실패 (${res.status})`,
                        );
                      }
                      // 즉시 폴링 재시작 — status 가 generating 으로 잡혀야 UI 가 진행 화면으로
                      setRefreshSignal((n) => n + 1);
                    } catch (err) {
                      setResumeError(
                        err instanceof Error
                          ? err.message
                          : "이어 만들기를 시작하지 못했어요.",
                      );
                    } finally {
                      setResuming(false);
                    }
                  }}
                  className="rounded-[10px] border border-[var(--accent)] bg-[var(--accent)] px-3 py-1.5 text-[12.5px] font-semibold text-white hover:opacity-90 disabled:opacity-40"
                >
                  {resuming ? "시작 중…" : "🪄 이어서 만들기"}
                </button>
              ) : null}
              <Link
                href={`/templates?deck=${deckId}${providerId ? `&provider=${providerId}` : ""}`}
                className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--text)] no-underline hover:bg-[var(--surface-2)] hover:no-underline"
              >
                ← 디자인 다시
              </Link>
              <Link
                href="/"
                className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--text)] no-underline hover:bg-[var(--surface-2)] hover:no-underline"
              >
                내 발표 자료
              </Link>
            </div>
            {resumeError ? (
              <div className="text-[12px] font-semibold text-[var(--danger)]">
                {resumeError}
              </div>
            ) : null}
          </div>
        ) : isEditingPage ? null : (
          <div className="flex items-center gap-2.5 rounded-[12px] border border-[#dbeafe] bg-[var(--accent-soft)] px-4 py-3 text-[13.5px]">
            <span>👀</span>
            <span>
              <b className="text-[var(--accent)]">
                완성된 슬라이드부터 바로 미리보기가 시작돼요.
              </b>{" "}
              나머지가 만들어지는 동안 먼저 본 슬라이드를 확인할 수 있어요.
              {editingEnabled ? (
                <>
                  {" "}
                  완성된 슬라이드는 <b>수정하기</b> 로 고칠 수 있어요.
                </>
              ) : null}
            </span>
          </div>
        )}
      </div>

      <div
        className={
          isEditingPage
            ? "flex min-h-0 flex-1 px-4 pt-3 pb-3"
            : "flex min-h-0 flex-1 gap-4 px-4 pt-3 pb-3"
        }
      >
        {isEditingPage ? null : (
          <ThumbPanel
            deckId={deckId}
            total={total}
            completedIdxs={completedSet}
            completedCount={completedCount}
            status={status}
            selectedIdx={selectedIdx}
            previewBust={previewBust}
            onPick={onPickSlide}
          />
        )}
        <MainPanel
          deckId={deckId}
          deckTitle={data.deck.title}
          providerId={providerId}
          total={total}
          completedIdxs={completedSet}
          selectedIdx={selectedIdx}
          previewBust={previewBust}
          editingEnabled={editingEnabled}
          editState={editState}
          onPick={onPickSlide}
          onEnterEdit={enterEditMode}
          onExitEdit={exitEditMode}
          onOpenBulkEdit={() => {
            setBulkError(null);
            setBulkModalOpen(true);
          }}
          exportPhase={exportPhase}
          onOpenExport={() => {
            if (exportPhase.kind === "idle") {
              setExportPhase({ kind: "select" });
            }
            setExportModalOpen(true);
          }}
          onOpenOutline={async () => {
            setOutlineError(null);
            setOutlineContent(null);
            setOutlineModalOpen(true);
            try {
              const res = await fetch(`/api/decks/${deckId}/outline`, {
                cache: "no-store",
              });
              const data = (await res.json().catch(() => null)) as {
                content?: string;
                error?: string;
              } | null;
              if (!res.ok || !data?.content) {
                throw new Error(data?.error ?? `요청 실패 (${res.status})`);
              }
              setOutlineContent(data.content);
            } catch (err) {
              setOutlineError(
                err instanceof Error
                  ? err.message
                  : "발표 구조를 불러오지 못했어요.",
              );
            }
          }}
        />
      </div>

      {exportModalOpen ? (
        <ExportModal
          deckId={deckId}
          phase={exportPhase}
          onPhaseChange={setExportPhase}
          onClose={() => setExportModalOpen(false)}
        />
      ) : null}

      {bulkModalOpen ? (
        <BulkEditModal
          deckId={deckId}
          error={bulkError}
          onError={setBulkError}
          onClose={() => setBulkModalOpen(false)}
          onStarted={() => {
            setBulkModalOpen(false);
            // 즉시 폴링 재시작 — stage 가 bulk-editing 으로 바로 잡혀야 사용자 화면 반응
            setRefreshSignal((n) => n + 1);
          }}
        />
      ) : null}

      {outlineModalOpen ? (
        <OutlineModal
          content={outlineContent}
          error={outlineError}
          duplicating={duplicating}
          onClose={() => setOutlineModalOpen(false)}
          onDuplicate={async () => {
            setDuplicating(true);
            try {
              const res = await fetch(
                `/api/decks/${deckId}/duplicate-from-outline`,
                { method: "POST" },
              );
              const data = (await res.json().catch(() => null)) as {
                deckId?: string;
                error?: string;
              } | null;
              if (!res.ok || !data?.deckId) {
                throw new Error(data?.error ?? `요청 실패 (${res.status})`);
              }
              // 새 deck 의 outline 검토 페이지로 이동 — 그 곳에서 검토 후 "이대로 만들기"
              const qs = providerId ? `?provider=${providerId}` : "";
              window.location.href = `/outline/${data.deckId}${qs}`;
            } catch (err) {
              setOutlineError(
                err instanceof Error
                  ? err.message
                  : "새 발표 자료를 만들지 못했어요.",
              );
              setDuplicating(false);
            }
          }}
        />
      ) : null}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <div className="flex-shrink-0">
        <TopNav active={5} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

function MakingBar({
  stage,
  pct,
  completed,
  total,
}: {
  stage: DeckStage;
  pct: number;
  completed: number;
  total: number;
}) {
  const label =
    stage === "ready"
      ? "완성"
      : stage === "failed"
        ? "실패"
        : stage === "planning"
          ? "발표 구조 잡는 중…"
          : stage === "finalizing"
            ? "마무리 검토 중…"
            : stage === "bulk-editing"
              ? "전체 슬라이드 수정 중…"
              : "슬라이드 그리는 중";

  const isReady = stage === "ready";
  const isBulk = stage === "bulk-editing";

  return (
    <div className="mb-3 flex items-center gap-4 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
      <span className="whitespace-nowrap text-[14px] font-semibold">
        {isBulk ? <span className="inline-block animate-spin">⟳</span> : null}{" "}
        {label}
      </span>
      <div className="relative h-2.5 flex-1 overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface-2)]">
        {isBulk ? (
          <span
            className="absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-[var(--accent)] to-[#60a5fa]"
            style={{
              animation: "bp-indeterminate 1.2s ease-in-out infinite",
            }}
          />
        ) : (
          <span
            className="block h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[#60a5fa] transition-[width] duration-300"
            style={{ width: `${isReady ? 100 : pct}%` }}
          />
        )}
        <style>{`
          @keyframes bp-indeterminate {
            0%   { left: -33%; }
            100% { left: 100%; }
          }
        `}</style>
      </div>
      {isBulk ? (
        <span className="whitespace-nowrap text-[12px] text-[var(--text-muted)]">
          처리 중
        </span>
      ) : (
        <>
          <span className="min-w-[42px] text-right text-[14px] font-bold text-[var(--accent)]">
            {isReady ? "100%" : `${pct}%`}
          </span>
          <span className="whitespace-nowrap font-mono text-[12px] text-[var(--text-muted)]">
            · {completed} / {total}장
          </span>
        </>
      )}
    </div>
  );
}

function ThumbPanel({
  deckId,
  total,
  completedIdxs,
  completedCount,
  status,
  selectedIdx,
  previewBust,
  onPick,
}: {
  deckId: string;
  total: number;
  completedIdxs: Set<number>;
  completedCount: number;
  status: DeckStatus;
  selectedIdx: number;
  previewBust: number;
  onPick: (idx: number) => void;
}) {
  const rows: React.ReactNode[] = [];
  for (let i = 0; i < total; i++) {
    if (completedIdxs.has(i)) {
      rows.push(
        <CompletedThumb
          key={`${i}-${previewBust}`}
          deckId={deckId}
          idx={i}
          active={selectedIdx === i}
          previewBust={previewBust}
          onClick={() => onPick(i)}
        />,
      );
    } else if (
      i === completedCount &&
      (status === "generating" || status === "draft")
    ) {
      rows.push(<InProgressThumb key={i} number={i + 1} />);
    } else {
      rows.push(<PendingThumb key={i} number={i + 1} />);
    }
  }

  return (
    <aside className="flex w-[220px] flex-shrink-0 flex-col rounded-[14px] border border-[var(--border)] bg-[var(--surface)]">
      <h3 className="mx-3 mt-3.5 mb-2 flex-shrink-0 text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
        슬라이드 {total}장
      </h3>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">{rows}</div>
    </aside>
  );
}

function CompletedThumb({
  deckId,
  idx,
  active,
  previewBust,
  onClick,
}: {
  deckId: string;
  idx: number;
  active: boolean;
  previewBust: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "relative mb-2.5 block aspect-video w-full overflow-hidden rounded-lg border-[3px] border-[var(--accent)] bg-white shadow-[0_0_0_4px_rgba(37,99,235,0.18),0_4px_12px_rgba(37,99,235,0.18)] outline-none transition-all"
          : "relative mb-2.5 block aspect-video w-full overflow-hidden rounded-lg border-2 border-transparent bg-white opacity-80 shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-all hover:-translate-y-0.5 hover:opacity-100 hover:shadow-[var(--shadow-md)]"
      }
    >
      <span className="absolute left-1 top-1 z-[2] rounded bg-white/85 px-1.5 py-0.5 text-[9px] font-bold text-[var(--text-muted)]">
        {idx + 1}
      </span>
      <ScaledSlideFrame
        title={`slide ${idx + 1}`}
        src={`/api/decks/${deckId}/slides/${idx}?v=${previewBust}`}
        autoDetect
        lazy
      />
    </button>
  );
}

function InProgressThumb({ number }: { number: number }) {
  return (
    <div className="relative mb-2.5 flex aspect-video w-full items-center justify-center rounded-lg border-2 border-dashed border-[var(--accent)] bg-[var(--accent-soft)] text-[11px] font-semibold text-[var(--accent)]">
      <span className="absolute left-1 top-1 rounded bg-white/85 px-1.5 py-0.5 text-[9px] font-bold text-[var(--text-muted)]">
        {number}
      </span>
      <span className="animate-pulse">만드는 중…</span>
    </div>
  );
}

function PendingThumb({ number }: { number: number }) {
  return (
    <div className="mb-2.5 flex aspect-video w-full items-center justify-center rounded-lg border-2 border-dashed border-[var(--border-strong)] bg-[var(--surface-2)] text-[11px] text-[var(--text-soft)]">
      {number} — 대기 중
    </div>
  );
}

function MainPanel({
  deckId,
  deckTitle,
  providerId,
  total,
  completedIdxs,
  selectedIdx,
  previewBust,
  editingEnabled,
  editState,
  onPick,
  onEnterEdit,
  onExitEdit,
  onOpenBulkEdit,
  exportPhase,
  onOpenExport,
  onOpenOutline,
}: {
  deckId: string;
  deckTitle: string;
  providerId: string;
  total: number;
  completedIdxs: Set<number>;
  selectedIdx: number;
  previewBust: number;
  editingEnabled: boolean;
  editState: EditState;
  onPick: (idx: number) => void;
  onEnterEdit: () => void;
  onExitEdit: () => void;
  onOpenBulkEdit: () => void;
  exportPhase: ExportPhase;
  onOpenExport: () => void;
  onOpenOutline: () => void;
}) {
  const hasCurrent = completedIdxs.has(selectedIdx);
  const prevIdx = findPrev(completedIdxs, selectedIdx);
  const nextIdx = findNext(completedIdxs, selectedIdx, total);
  const isEditing =
    editState.kind === "active" || editState.kind === "starting";

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      {isEditing ? (
        <div className="flex flex-shrink-0 items-center gap-4 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-5 py-3">
          <span className="truncate text-[16px] font-bold tracking-[-0.01em]">
            {deckTitle}
          </span>
          <span className="hidden text-[13px] text-[var(--text-muted)] md:inline">
            슬라이드를 고치고 있어요. 다 끝나면 오른쪽 버튼을 눌러 미리보기로 돌아가요.
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={onExitEdit}
            disabled={editState.kind === "starting"}
            className="inline-flex items-center gap-2 rounded-[12px] border border-[var(--primary)] bg-[var(--primary)] px-5 py-2.5 text-[14px] font-semibold text-[var(--primary-foreground)] transition-colors hover:bg-[var(--primary-hover)] disabled:opacity-50"
          >
            ✓ 수정 끝내고 미리보기로
          </button>
        </div>
      ) : (
        <div className="flex flex-shrink-0 items-center gap-3 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <span className="truncate text-[16px] font-bold tracking-[-0.01em]">
            {deckTitle}
          </span>
          <div className="flex-1" />
          <Link
            href={`/templates?deck=${deckId}${providerId ? `&provider=${providerId}` : ""}`}
            className="rounded-[10px] border border-[var(--border)] bg-transparent px-3 py-2 text-[13px] font-medium text-[var(--text)] no-underline hover:bg-[var(--surface-2)] hover:no-underline"
          >
            ← 디자인 바꾸기
          </Link>
          <button
            type="button"
            onClick={onOpenOutline}
            className="inline-flex items-center gap-2 rounded-[10px] border border-[var(--border)] bg-transparent px-3 py-2 text-[13px] font-medium text-[var(--text)] hover:bg-[var(--surface-2)]"
            title="발표 자료의 outline (구조) 보기"
          >
            📋 발표 구조
          </button>
          <button
            type="button"
            onClick={editingEnabled ? onOpenBulkEdit : undefined}
            disabled={!editingEnabled}
            title={
              !editingEnabled
                ? "슬라이드가 완성되면 전체 수정할 수 있어요"
                : "한 줄 지시로 전체 슬라이드 일괄 수정"
            }
            className={
              editingEnabled
                ? "inline-flex items-center gap-2 rounded-[10px] border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-2 text-[13.5px] font-semibold text-[var(--accent)] hover:bg-[#dbeafe]"
                : "inline-flex cursor-not-allowed items-center gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-[13.5px] font-medium text-[var(--text-muted)] opacity-50"
            }
          >
            ✨ 전체 수정
          </button>
          <button
            type="button"
            onClick={editingEnabled ? onOpenExport : undefined}
            disabled={!editingEnabled}
            title={
              !editingEnabled
                ? "슬라이드가 완성되면 받을 수 있어요"
                : "PDF / 이미지 / 파워포인트 등으로 받기"
            }
            className={
              editingEnabled
                ? "inline-flex items-center gap-2 rounded-[10px] border border-[var(--success)] bg-[var(--success-soft)] px-4 py-2 text-[13.5px] font-semibold text-[var(--success)] hover:opacity-90"
                : "inline-flex cursor-not-allowed items-center gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-[13.5px] font-medium text-[var(--text-muted)] opacity-50"
            }
          >
            ⬇ 내보내기
            {exportPhase.kind === "running" || exportPhase.kind === "starting" ? (
              <span className="inline-block animate-spin">⟳</span>
            ) : null}
            {exportPhase.kind === "done" ? <span>✓</span> : null}
          </button>
          <button
            type="button"
            onClick={editingEnabled ? onEnterEdit : undefined}
            disabled={!editingEnabled}
            title={
              !editingEnabled
                ? "지금은 수정할 수 없어요"
                : undefined
            }
            className={
              editingEnabled
                ? "inline-flex items-center gap-2 rounded-[10px] border border-[var(--primary)] bg-[var(--primary)] px-4 py-2 text-[13.5px] font-semibold text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]"
                : "inline-flex cursor-not-allowed items-center gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-[13.5px] font-medium text-[var(--text-muted)] opacity-50"
            }
          >
            ✎ 수정하기
          </button>
        </div>
      )}

      {editState.kind === "error" ? (
        <div className="flex-shrink-0 rounded-[12px] border border-[rgba(239,68,68,0.25)] bg-[var(--danger-soft)] px-4 py-3 text-[13.5px] font-semibold text-[var(--danger)]">
          {editState.message}
        </div>
      ) : null}

      {isEditing ? (
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-[14px] border border-[var(--border)] bg-[var(--surface)]">
          {editState.kind === "starting" ? (
            <div className="absolute inset-0 flex items-center justify-center text-[14px] text-[var(--text-muted)]">
              수정 도구 켜는 중…
            </div>
          ) : (
            <iframe
              title="slides-grab 수정 도구"
              src={editState.url}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
              className="h-full w-full border-0"
            />
          )}
        </div>
      ) : (
        <>
          <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-4">
            {hasCurrent ? (
              <ScaledSlideFrame
                title={`slide ${selectedIdx + 1}`}
                src={`/api/decks/${deckId}/slides/${selectedIdx}?v=${previewBust}`}
                autoDetect
                blockInteraction={false}
                className="rounded-[12px] bg-white shadow-[0_10px_30px_rgba(0,0,0,0.12)]"
              />
            ) : (
              <div
                className="flex aspect-video w-full max-w-[min(100%,calc(100%*16/9))] flex-col items-center justify-center rounded-[12px] bg-[var(--surface-2)] text-[14px] text-[var(--text-muted)]"
              >
                <div className="animate-pulse">슬라이드 만드는 중…</div>
                <div className="mt-2 text-[12px]">
                  왼쪽에서 완성된 슬라이드를 골라 미리 볼 수 있어요.
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-shrink-0 items-center justify-center gap-3 text-[13px] text-[var(--text-muted)]">
            <button
              type="button"
              disabled={prevIdx === null}
              onClick={() => prevIdx !== null && onPick(prevIdx)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] disabled:opacity-30"
              aria-label="이전 슬라이드"
            >
              ◀
            </button>
            <span>
              <b className="text-[var(--text)]">{selectedIdx + 1}</b> / {total}
            </span>
            <button
              type="button"
              disabled={nextIdx === null}
              onClick={() => nextIdx !== null && onPick(nextIdx)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] disabled:opacity-30"
              aria-label="다음 슬라이드"
            >
              ▶
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function findPrev(set: Set<number>, current: number): number | null {
  for (let i = current - 1; i >= 0; i--) {
    if (set.has(i)) return i;
  }
  return null;
}

function findNext(set: Set<number>, current: number, total: number): number | null {
  for (let i = current + 1; i < total; i++) {
    if (set.has(i)) return i;
  }
  return null;
}

function BulkEditModal({
  deckId,
  error,
  onError,
  onClose,
  onStarted,
}: {
  deckId: string;
  error: string | null;
  onError: (msg: string | null) => void;
  onClose: () => void;
  onStarted: () => void;
}) {
  const [instruction, setInstruction] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  const submit = async () => {
    const trimmed = instruction.trim();
    if (!trimmed) {
      onError("어떻게 고칠지 한 줄 적어 주세요.");
      return;
    }
    onError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/decks/${deckId}/bulk-edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: trimmed }),
      });
      const data = (await res.json().catch(() => null)) as {
        started?: boolean;
        reason?: string;
        error?: string;
      } | null;
      if (!res.ok || !data?.started) {
        throw new Error(data?.error ?? data?.reason ?? `HTTP ${res.status}`);
      }
      onStarted();
    } catch (err) {
      onError(err instanceof Error ? err.message : "요청을 보내지 못했어요.");
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-6 backdrop-blur-sm"
      onClick={() => !submitting && onClose()}
    >
      <div
        className="flex w-full max-w-[560px] flex-col overflow-hidden rounded-[16px] bg-[var(--surface)] shadow-[var(--shadow-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-4">
          <span className="text-[16px] font-bold tracking-[-0.01em]">
            ✨ 전체 슬라이드 일괄 수정
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => !submitting && onClose()}
            disabled={submitting}
            aria-label="닫기"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[15px] text-[var(--text-muted)] hover:bg-[var(--surface-2)] disabled:opacity-40"
          >
            ✕
          </button>
        </div>
        <div className="flex flex-col gap-3 px-5 py-5">
          <label
            htmlFor="bulk-instr"
            className="text-[13.5px] font-semibold"
          >
            어떻게 고칠까요?
          </label>
          <textarea
            id="bulk-instr"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder='예: 모든 슬라이드의 여백을 동일하게 맞춰줘'
            rows={4}
            disabled={submitting}
            className="w-full resize-y rounded-[10px] border-[1.5px] border-[var(--border)] bg-[var(--surface)] px-3.5 py-3 text-[14px] outline-none transition-colors focus:border-[var(--primary)] disabled:opacity-50"
          />
          <div className="text-[12.5px] text-[var(--text-muted)]">
            <b className="text-[var(--text)]">예시</b>
            <ul className="mt-1 list-disc pl-5">
              <li>“여백을 모든 슬라이드에서 동일하게 맞춰줘”</li>
              <li>“제목 글자 크기를 조금 더 크게”</li>
              <li>“메인 색깔을 모두 #3b82f6 (파랑) 으로 통일”</li>
              <li>“각 슬라이드 하단 footer 글자 크기 절반으로”</li>
            </ul>
          </div>
          <div className="rounded-[10px] border border-[#dbeafe] bg-[var(--accent-soft)] px-3.5 py-2.5 text-[12.5px]">
            💡 기본은 기존 슬라이드 수정. <b>“슬라이드 한 장 더 추가해줘”</b> / <b>“3번째 슬라이드 빼줘”</b> 같이 명시하면 추가·삭제도 됩니다. inline 구조 (색깔/굵기 등) 는 보존돼요.
          </div>
          {error ? (
            <div className="rounded-[10px] border border-[rgba(239,68,68,0.25)] bg-[var(--danger-soft)] px-3.5 py-2.5 text-[12.5px] font-semibold text-[var(--danger)]">
              {error}
            </div>
          ) : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-[10px] border border-[var(--border)] bg-transparent px-4 py-2 text-[13.5px] font-medium text-[var(--text)] hover:bg-[var(--surface-2)] disabled:opacity-40"
          >
            취소
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="rounded-[10px] border border-[var(--accent)] bg-[var(--accent)] px-5 py-2 text-[13.5px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "보내는 중…" : "✨ 적용"}
          </button>
        </div>
      </div>
    </div>
  );
}

function OutlineModal({
  content,
  error,
  duplicating,
  onClose,
  onDuplicate,
}: {
  content: string | null;
  error: string | null;
  duplicating: boolean;
  onClose: () => void;
  onDuplicate: () => void;
}) {
  const loading = content === null && error === null;
  const [copied, setCopied] = useState(false);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-6 backdrop-blur-sm"
      onClick={() => !duplicating && onClose()}
    >
      <div
        className="flex h-[85vh] w-full max-w-[920px] flex-col overflow-hidden rounded-[16px] bg-[var(--surface)] shadow-[var(--shadow-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-4">
          <span className="text-[16px] font-bold tracking-[-0.01em]">
            📋 발표 구조 (outline)
          </span>
          <span className="text-[12.5px] text-[var(--text-muted)]">
            AI 가 발표 자료를 만들 때 사용한 설계도예요.
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            disabled={duplicating}
            className="rounded-md px-2 py-1 text-[var(--text-muted)] hover:bg-[var(--surface-2)] disabled:opacity-40"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-[var(--surface-2)] p-4">
          {loading ? (
            <div className="text-center text-[14px] text-[var(--text-muted)]">
              불러오는 중…
            </div>
          ) : error ? (
            <div className="rounded-lg border border-[rgba(239,68,68,0.25)] bg-[var(--danger-soft)] px-4 py-3 text-[13.5px] font-semibold text-[var(--danger)]">
              {error}
            </div>
          ) : (
            <pre className="m-0 h-full whitespace-pre-wrap break-words rounded-lg border border-[var(--border)] bg-white p-4 font-mono text-[13px] leading-[1.6] text-[var(--text)]">
              {content}
            </pre>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] px-5 py-3">
          {content ? (
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(content);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch {
                  // clipboard 권한 거부 시 silent — 사용자가 직접 선택해서 복사 가능
                }
              }}
              disabled={duplicating}
              className="rounded-[10px] border border-[var(--border)] bg-transparent px-3 py-2 text-[13px] font-semibold text-[var(--text)] hover:bg-[var(--surface-2)] disabled:opacity-40"
            >
              {copied ? "✓ 복사됨" : "📋 복사"}
            </button>
          ) : null}
          <div className="flex-1" />
          {content ? (
            <button
              type="button"
              onClick={onDuplicate}
              disabled={duplicating}
              className="rounded-[10px] border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2 text-[13px] font-semibold text-[var(--accent)] hover:bg-[#dbeafe] disabled:opacity-40"
              title="원본은 그대로 두고 이 outline 으로 새 발표 자료를 만듭니다 (디자인·내용 같은 거 그대로)"
            >
              {duplicating
                ? "새로 만드는 중…"
                : "🔁 이 구조로 새로 만들기"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            disabled={duplicating}
            className="rounded-[10px] border border-[var(--border)] bg-transparent px-3 py-2 text-[13px] font-semibold text-[var(--text)] hover:bg-[var(--surface-2)] disabled:opacity-40"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
