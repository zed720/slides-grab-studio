"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { TopNav } from "@/components/TopNav";

type DeckStatus =
  | "draft"
  | "outlining"
  | "outline-ready"
  | "generating"
  | "ready"
  | "failed";

type StatusResp = {
  deck: {
    id: string;
    title: string;
    status: DeckStatus;
    template_id: string | null;
    provider_id: string | null;
  };
};

type FetchState =
  | { kind: "loading" }
  | { kind: "outlining" }
  | { kind: "ready"; title: string; templateId: string | null; content: string }
  | { kind: "starting"; title: string; templateId: string | null; content: string }
  | { kind: "failed"; message: string };

const POLL_MS = 1000;

export default function OutlinePage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const deckId = params.id;
  const providerId = searchParams.get("provider") ?? "";

  const [state, setState] = useState<FetchState>({ kind: "loading" });
  const [saveError, setSaveError] = useState<string | null>(null);
  const kickStartedRef = useRef(false);

  const fetchStatus = useCallback(async (): Promise<StatusResp | null> => {
    try {
      const res = await fetch(`/api/decks/${deckId}/status`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as StatusResp;
    } catch (err) {
      setState({
        kind: "failed",
        message: err instanceof Error ? err.message : "상태를 확인하지 못했어요.",
      });
      return null;
    }
  }, [deckId]);

  const kickPlanning = useCallback(async () => {
    if (kickStartedRef.current) return;
    kickStartedRef.current = true;
    try {
      await fetch(`/api/decks/${deckId}/generate`, { method: "POST" });
    } catch {}
  }, [deckId]);

  const fetchOutline = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch(`/api/decks/${deckId}/outline`, {
        cache: "no-store",
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { content: string };
      return data.content;
    } catch {
      return null;
    }
  }, [deckId]);

  // 폴링: status outlining/draft → ready 신호 잡고 outline 로딩
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const loop = async () => {
      if (cancelled) return;
      const data = await fetchStatus();
      if (cancelled || !data) return;
      const s = data.deck.status;

      if (s === "draft") {
        // 안전망: 디자인 안 골랐으면 화면 3 (디자인 고르기) 로 — outline 자동 시작 X
        if (!data.deck.template_id) {
          const qs = new URLSearchParams({ deck: deckId });
          if (providerId) qs.set("provider", providerId);
          router.replace(`/templates?${qs.toString()}`);
          return;
        }
        // 디자인은 골랐고 아직 plan 안 시작 — 시작 호출 + 폴링
        setState({ kind: "outlining" });
        await kickPlanning();
        timer = setTimeout(loop, POLL_MS);
        return;
      }
      if (s === "outlining") {
        setState({ kind: "outlining" });
        timer = setTimeout(loop, POLL_MS);
        return;
      }
      if (s === "outline-ready") {
        const content = await fetchOutline();
        if (cancelled) return;
        if (content !== null) {
          setState({
            kind: "ready",
            title: data.deck.title,
            templateId: data.deck.template_id,
            content,
          });
        } else {
          timer = setTimeout(loop, POLL_MS);
        }
        return;
      }
      if (s === "generating" || s === "ready") {
        // 이미 design 들어감 → deck 페이지로
        const qs = providerId ? `?provider=${providerId}` : "";
        router.replace(`/deck/${deckId}${qs}`);
        return;
      }
      if (s === "failed") {
        setState({
          kind: "failed",
          message:
            "outline 만들기에 실패했어요. 디자인을 다시 골라 처음부터 시도해 주세요.",
        });
        return;
      }
    };
    loop();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [deckId, fetchOutline, fetchStatus, kickPlanning, providerId, router]);

  // editable content
  const [draft, setDraft] = useState<string>("");
  useEffect(() => {
    // state 가 ready 로 한 번 set 되면 polling loop 가 멈춰서 더 이상 trigger 되지 않음.
    // 즉 사용자의 textarea 편집이 reset 되지 않는다 — cascading 경고는 보수적.
    if (state.kind === "ready" || state.kind === "starting") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft(state.content);
    }
  }, [state]);

  const startDesign = useCallback(async () => {
    if (state.kind !== "ready") return;
    setSaveError(null);
    setState({ ...state, kind: "starting" });
    try {
      // 1) 편집한 내용 저장
      if (draft !== state.content) {
        const putRes = await fetch(`/api/decks/${deckId}/outline`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: draft }),
        });
        if (!putRes.ok) {
          const body = (await putRes.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error ?? `outline 저장 실패 (HTTP ${putRes.status})`);
        }
      }
      // 2) design 시작
      const postRes = await fetch(`/api/decks/${deckId}/start`, {
        method: "POST",
      });
      if (!postRes.ok) {
        const body = (await postRes.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? `시작 실패 (HTTP ${postRes.status})`);
      }
      // 3) deck 페이지로
      const qs = providerId ? `?provider=${providerId}` : "";
      router.replace(`/deck/${deckId}${qs}`);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "시작하지 못했어요.",
      );
      setState({ ...state, kind: "ready" });
    }
  }, [deckId, draft, providerId, router, state]);

  const goBackToTemplates = () => {
    const qs = new URLSearchParams();
    qs.set("deck", deckId);
    if (providerId) qs.set("provider", providerId);
    router.replace(`/templates?${qs.toString()}`);
  };

  return (
    <>
      <TopNav active={4} />
      <main className="mx-auto w-full max-w-[1280px] px-6 pt-8 pb-16">
        {state.kind === "loading" ? (
          <Loading />
        ) : state.kind === "outlining" ? (
          <Planning />
        ) : state.kind === "failed" ? (
          <ErrorBox message={state.message} onBack={goBackToTemplates} />
        ) : (
          <ReviewBody
            title={state.kind === "ready" ? state.title : state.title}
            templateId={
              state.kind === "ready" ? state.templateId : state.templateId
            }
            content={draft}
            onChange={setDraft}
            onBack={goBackToTemplates}
            onStart={startDesign}
            starting={state.kind === "starting"}
            saveError={saveError}
          />
        )}
      </main>
    </>
  );
}

function Loading() {
  return (
    <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-6 py-5 text-[14px] text-[var(--text-muted)]">
      상태 확인 중…
    </div>
  );
}

function Planning() {
  return (
    <div className="rounded-[14px] border border-dashed border-[var(--border)] bg-[var(--surface-2)] py-20 text-center">
      <div
        className="mx-auto mb-3 h-11 w-11 rounded-full border-[3px] border-[var(--border)]"
        style={{
          borderTopColor: "var(--accent)",
          animation: "spin 0.9s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div className="mb-1 text-[15px] font-bold">발표 구조 잡는 중…</div>
      <div className="text-[13px] text-[var(--text-muted)]">
        AI 가 어떤 슬라이드를 만들지 짧게 정리하고 있어요. (30초~2분)
      </div>
    </div>
  );
}

function ErrorBox({
  message,
  onBack,
}: {
  message: string;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-[rgba(239,68,68,0.25)] bg-[var(--danger-soft)] p-6 text-[14px] text-[var(--danger)]">
      <div className="font-semibold">발표 구조를 만들지 못했어요</div>
      <div className="text-[var(--text-muted)]">{message}</div>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[13.5px] font-semibold text-[var(--text)] hover:bg-[var(--surface-2)]"
        >
          ← 디자인 다시
        </button>
        <Link
          href="/"
          className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[13.5px] font-semibold text-[var(--text)] no-underline hover:bg-[var(--surface-2)] hover:no-underline"
        >
          내 발표 자료
        </Link>
      </div>
    </div>
  );
}

function ReviewBody({
  title,
  templateId,
  content,
  onChange,
  onBack,
  onStart,
  starting,
  saveError,
}: {
  title: string;
  templateId: string | null;
  content: string;
  onChange: (s: string) => void;
  onBack: () => void;
  onStart: () => void;
  starting: boolean;
  saveError: string | null;
}) {
  const meta = parseMeta(content);
  return (
    <div className="overflow-hidden rounded-[14px] border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-3">
        <span className="truncate text-[16px] font-bold tracking-[-0.01em]">
          발표 구조
        </span>
        <span className="truncate text-[12.5px] text-[var(--text-muted)]">
          — {title}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onBack}
          disabled={starting}
          className="rounded-[10px] border border-[var(--border)] bg-transparent px-3.5 py-2 text-[13px] font-medium text-[var(--text)] hover:bg-[var(--surface-2)] disabled:opacity-50"
        >
          ← 디자인 다시
        </button>
        <button
          type="button"
          onClick={onStart}
          disabled={starting || content.trim().length === 0}
          className="rounded-[10px] border border-[var(--primary)] bg-[var(--primary)] px-4 py-2 text-[13.5px] font-semibold text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)] disabled:opacity-50"
        >
          {starting ? "시작하는 중…" : "이대로 만들기 →"}
        </button>
      </div>

      <div className="grid grid-cols-[200px_1fr] gap-5 px-5 py-5">
        <aside className="text-[12.5px] text-[var(--text-muted)]">
          <Meta label="분량">
            {meta.slides ? <b className="text-[var(--text)]">{meta.slides}장</b> : "—"}
          </Meta>
          <Meta label="디자인">{templateId ?? meta.style ?? "—"}</Meta>
          {meta.source.length > 0 ? (
            <Meta label="발표 자료 출처">
              {meta.source.map((s) => (
                <code
                  key={s}
                  className="mr-1 inline-block rounded bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text)]"
                >
                  {s}
                </code>
              ))}
            </Meta>
          ) : null}
          <Meta label="힌트">
            <ul className="m-0 list-none p-0">
              <li>· 슬라이드 빼기·추가는 “## Slide N — 제목” 줄 단위</li>
              <li className="mt-1">· 분량 줄이려면 슬라이드 섹션 통째로 삭제</li>
              <li className="mt-1">· <code className="font-mono">approval:</code> 줄은 그대로 두기</li>
            </ul>
          </Meta>
        </aside>

        <div className="flex flex-col gap-2">
          <label className="text-[12.5px] text-[var(--text-muted)]">
            슬라이드 한 장당 한 섹션. 자유롭게 수정 →{" "}
            <b className="text-[var(--text)]">이대로 만들기</b> 누르면 그대로 사용돼요.
          </label>
          <textarea
            value={content}
            onChange={(e) => onChange(e.target.value)}
            disabled={starting}
            spellCheck={false}
            className="min-h-[480px] w-full resize-y rounded-[12px] border-[1.5px] border-[var(--border)] bg-[#fcfcfd] px-4 py-3.5 font-mono text-[12.5px] leading-[1.55] text-[var(--text)] outline-none focus:border-[var(--primary)] disabled:opacity-50"
          />
          <div className="rounded-[10px] border border-[#dbeafe] bg-[var(--accent-soft)] px-3.5 py-2.5 text-[12.5px]">
            💡 frontmatter (가장 위{" "}
            <code className="font-mono">---</code> 사이) 의{" "}
            <code className="font-mono">style</code> 만 손대지 마세요 —
            화면 3 에서 고른 디자인 id 예요. 슬라이드 내용은 자유롭게.
          </div>
          {saveError ? (
            <div className="rounded-[10px] border border-[rgba(239,68,68,0.25)] bg-[var(--danger-soft)] px-3.5 py-2.5 text-[12.5px] font-semibold text-[var(--danger)]">
              {saveError}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3.5">
      <h4 className="m-0 mb-1 text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--text-soft)]">
        {label}
      </h4>
      <div>{children}</div>
    </div>
  );
}

// outline.md 의 frontmatter 에서 slides / style / source 만 가볍게 추출
function parseMeta(content: string): {
  slides: number | null;
  style: string | null;
  source: string[];
} {
  const fmMatch = /^---\s*\n([\s\S]*?)\n---/.exec(content);
  if (!fmMatch) return { slides: null, style: null, source: [] };
  const fm = fmMatch[1];
  const slides = (() => {
    const m = /^slides:\s*(\d+)/m.exec(fm);
    return m ? parseInt(m[1], 10) : null;
  })();
  const style = (() => {
    const m = /^style:\s*([^\n]+)/m.exec(fm);
    return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
  })();
  const source: string[] = [];
  const sm = /^source:\s*\n([\s\S]*?)(?:\n[a-zA-Z]|$)/m.exec(fm);
  if (sm) {
    for (const line of sm[1].split(/\n/)) {
      const m = /^\s*-\s*(.+?)\s*$/.exec(line);
      if (m) source.push(m[1]);
    }
  }
  return { slides, style, source };
}
