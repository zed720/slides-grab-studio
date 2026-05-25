"use client";

import Link from "next/link";
import { ScaledSlideFrame } from "@/components/ScaledSlideFrame";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { TopNav } from "@/components/TopNav";

type Template = {
  id: string;
  name: string;
  description: string;
  previewHtml: string;
  custom?: boolean;
  updatedAt?: number;
};

type FetchState =
  | { kind: "loading" }
  | { kind: "ok"; templates: Template[] }
  | { kind: "error"; message: string };

export default function TemplatesPage() {
  return (
    <Suspense fallback={<Shell><Loading /></Shell>}>
      <TemplatesInner />
    </Suspense>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNav active={3} />
      <main className="mx-auto w-full max-w-[1440px] px-6 pt-6 pb-32">
        {children}
      </main>
    </>
  );
}

function TemplatesInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deckId = searchParams.get("deck");
  const providerId = searchParams.get("provider") ?? "";

  const [state, setState] = useState<FetchState>({ kind: "loading" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalId, setModalId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/templates", { cache: "no-store" });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }
        const data = (await res.json()) as { templates: Template[] };
        if (cancelled) return;
        setState({ kind: "ok", templates: data.templates });
      } catch (err) {
        if (cancelled) return;
        setState({
          kind: "error",
          message:
            err instanceof Error
              ? err.message
              : "디자인 목록을 불러오지 못했어요.",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedTemplate =
    state.kind === "ok"
      ? state.templates.find((t) => t.id === selectedId) ?? null
      : null;
  const modalTemplate =
    state.kind === "ok"
      ? state.templates.find((t) => t.id === modalId) ?? null
      : null;

  const onConfirm = useCallback(async () => {
    if (!selectedTemplate || !deckId) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/decks/${deckId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: selectedTemplate.id }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const next = new URLSearchParams();
      if (providerId) next.set("provider", providerId);
      const qs = next.toString();
      router.push(`/outline/${deckId}${qs ? `?${qs}` : ""}`);
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "디자인을 저장하지 못했어요.",
      );
      setSubmitting(false);
    }
  }, [selectedTemplate, deckId, providerId, router]);

  return (
    <Shell>
      <div className="mb-6">
        <h1 className="m-0 mb-2 text-[32px] font-bold leading-tight tracking-[-0.02em]">
          어떤 분위기로 만들까요?
        </h1>
        <p className="m-0 text-[16px] text-[var(--text-muted)]">
          마음에 드는 디자인을 골라주세요. 카드의 ⛶ 아이콘을 누르면 더 큰 화면에서 자세히 볼 수 있어요.
        </p>
      </div>

      <div className="mb-4 flex items-center gap-2.5 rounded-[12px] border border-[#dbeafe] bg-[var(--accent-soft)] px-4 py-3 text-[13.5px]">
        <span>💡</span>
        <span>
          아래 디자인들은 <b>slides-grab</b> 에서 바로 가져온 진짜 슬라이드 견본이에요. 카드 안에 보이는 작은 슬라이드 그대로 발표 자료가 만들어집니다.
        </span>
      </div>

      {state.kind === "ok" ? (
        <div className="mb-4 text-[13px] text-[var(--text-muted)]">
          전체 <b className="text-[var(--text)]">{state.templates.length}종</b>
        </div>
      ) : null}

      {state.kind === "loading" ? (
        <Loading />
      ) : state.kind === "error" ? (
        <ErrorBox message={state.message} />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {state.templates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              selected={selectedId === t.id}
              onSelect={() => setSelectedId(t.id)}
              onExpand={() => setModalId(t.id)}
            />
          ))}
        </div>
      )}

      {submitError ? (
        <div className="mt-6 flex items-center gap-2 rounded-[10px] border border-[rgba(239,68,68,0.25)] bg-[var(--danger-soft)] px-4 py-3 text-[13.5px] font-semibold text-[var(--danger)]">
          <span>!</span>
          <span>{submitError}</span>
        </div>
      ) : null}

      {/* fixed 하단 액션 바 — 스크롤 어디 있든 항상 viewport 하단에 떠 있음 */}
      <div
        className="fixed bottom-0 left-0 right-0 z-30 flex items-center gap-3.5 border-t border-[var(--border)] px-6 py-3.5"
        style={{
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "saturate(180%) blur(14px)",
          WebkitBackdropFilter: "saturate(180%) blur(14px)",
          boxShadow: "0 -2px 12px rgba(0,0,0,0.04)",
        }}
      >
        <Link
          href={
            deckId
              ? `/upload${providerId ? `?provider=${providerId}` : ""}`
              : "/upload"
          }
          className="inline-flex items-center gap-2 rounded-[10px] border border-[var(--border)] bg-transparent px-4 py-2.5 text-[14px] font-semibold text-[var(--text)] no-underline transition-colors hover:bg-[var(--surface-2)] hover:no-underline"
        >
          ← 이전
        </Link>
        <div className="min-w-0 flex-1 truncate text-[13px] text-[var(--text-muted)]">
          {selectedTemplate ? (
            <>
              선택: <b className="text-[var(--text)]">{selectedTemplate.name}</b>
            </>
          ) : (
            <span className="text-[var(--text-soft)]">
              디자인을 골라 주세요.
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!selectedTemplate || !deckId || submitting}
          className="inline-flex items-center gap-2 rounded-[12px] border border-[var(--primary)] bg-[var(--primary)] px-5 py-3 text-[15px] font-semibold text-[var(--primary-foreground)] transition-colors hover:bg-[var(--primary-hover)] disabled:opacity-40"
        >
          {submitting
            ? "저장 중…"
            : selectedTemplate
              ? `${selectedTemplate.name} 로 만들기 →`
              : "디자인 정했어요 →"}
        </button>
      </div>

      {modalTemplate ? (
        <PreviewModal
          template={modalTemplate}
          onClose={() => setModalId(null)}
          onPick={() => {
            setSelectedId(modalTemplate.id);
            setModalId(null);
          }}
        />
      ) : null}
    </Shell>
  );
}

function TemplateCard({
  template,
  selected,
  onSelect,
  onExpand,
}: {
  template: Template;
  selected: boolean;
  onSelect: () => void;
  onExpand: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={
        selected
          ? "group relative flex cursor-pointer flex-col overflow-hidden rounded-[14px] border-2 border-[var(--primary)] bg-[var(--surface)] text-left shadow-[0_0_0_3px_rgba(24,24,27,0.08),var(--shadow-md)] transition-all"
          : "group relative flex cursor-pointer flex-col overflow-hidden rounded-[14px] border-2 border-[var(--border)] bg-[var(--surface)] text-left transition-all hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-md)]"
      }
    >
      {selected ? (
        <span className="absolute right-2.5 top-2.5 z-[2] inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--primary)] text-[14px] font-bold text-[var(--primary-foreground)] shadow-md">
          ✓
        </span>
      ) : null}
      {template.custom ? (
        <span className="absolute left-2.5 top-2.5 z-[2] inline-flex items-center gap-1 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10.5px] font-bold tracking-wide text-white shadow-sm">
          내 양식
        </span>
      ) : (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onExpand();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onExpand();
            }
          }}
          className="absolute left-2.5 top-2.5 z-[2] inline-flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-lg bg-white/95 text-[12px] font-semibold text-[var(--text)] opacity-0 shadow-[0_2px_6px_rgba(0,0,0,0.12)] transition-opacity group-hover:opacity-100"
          aria-label="크게 보기"
        >
          ⛶
        </span>
      )}
      <div className="relative aspect-video overflow-hidden bg-white">
        {template.custom ? (
          <ScaledSlideFrame
            title={template.name}
            src={`/api/my-templates/${template.id.slice("custom:".length)}/preview?v=${template.updatedAt ?? ""}`}
            lazy
          />
        ) : (
          <ScaledSlideFrame
            title={template.name}
            srcDoc={template.previewHtml}
            lazy
          />
        )}
      </div>
      <div className="border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3.5">
        <div className="mb-0.5 text-[15px] font-bold tracking-[-0.01em]">
          {template.name}
        </div>
        <div className="text-[12.5px] leading-tight text-[var(--text-muted)]">
          {template.description}
        </div>
      </div>
    </button>
  );
}

function PreviewModal({
  template,
  onClose,
  onPick,
}: {
  template: Template;
  onClose: () => void;
  onPick: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-[1080px] flex-col overflow-hidden rounded-[18px] bg-[var(--surface)] shadow-[var(--shadow-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3.5 border-b border-[var(--border)] px-5 py-4">
          <div>
            <div className="text-[17px] font-bold tracking-[-0.01em]">
              {template.name}
            </div>
            <div className="mt-0.5 text-[13px] text-[var(--text-muted)]">
              {template.description}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg text-[16px] hover:bg-[var(--surface-2)]"
          >
            ✕
          </button>
        </div>
        <div className="flex flex-1 flex-col items-center gap-3.5 overflow-y-auto bg-[var(--surface-2)] p-7">
          <div className="aspect-video w-full max-w-[900px] overflow-hidden rounded-[14px] bg-white shadow-[var(--shadow-md)]">
            <iframe
              title={template.name}
              srcDoc={template.previewHtml}
              sandbox=""
              className="h-full w-full border-0"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2.5 border-t border-[var(--border)] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[10px] border border-[var(--border)] bg-transparent px-5 py-2.5 text-[14px] font-semibold text-[var(--text)] hover:bg-[var(--surface-2)]"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={onPick}
            className="rounded-[10px] border border-[var(--primary)] bg-[var(--primary)] px-5 py-2.5 text-[14px] font-semibold text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]"
          >
            이걸로 정하기
          </button>
        </div>
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex animate-pulse flex-col overflow-hidden rounded-[14px] border-2 border-[var(--border)] bg-[var(--surface)]"
        >
          <div className="aspect-video bg-[var(--surface-2)]" />
          <div className="border-t border-[var(--border)] px-4 py-3.5">
            <div className="mb-2 h-4 w-32 rounded bg-[var(--border)]" />
            <div className="h-3 w-44 rounded bg-[var(--border)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-[16px] border border-[rgba(239,68,68,0.25)] bg-[var(--danger-soft)] p-6 text-[14px] text-[var(--danger)]">
      <div className="font-semibold">디자인 목록을 불러오지 못했어요</div>
      <div className="text-[var(--text-muted)]">{message}</div>
    </div>
  );
}
