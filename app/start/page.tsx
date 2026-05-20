"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { TopNav } from "@/components/TopNav";
import type { ProviderId, ProviderStatus } from "@/lib/providers";

type FetchState =
  | { kind: "loading" }
  | { kind: "ok"; providers: ProviderStatus[] }
  | { kind: "error"; message: string };

const ICON_LABEL: Record<ProviderId, string> = {
  "claude-code": "C",
  codex: "X",
};

const ICON_BG: Record<ProviderId, string> = {
  "claude-code": "bg-[var(--primary)]",
  codex: "bg-gradient-to-br from-[#10b981] to-[#059669]",
};

export default function CheckPage() {
  const [state, setState] = useState<FetchState>({ kind: "loading" });
  const [selectedId, setSelectedId] = useState<ProviderId | null>(null);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/providers", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { providers: ProviderStatus[] };
      setState({ kind: "ok", providers: data.providers });
      const firstUsable = data.providers.find(isProviderUsable);
      setSelectedId((prev) => {
        const prevP = prev
          ? data.providers.find((p) => p.id === prev)
          : null;
        if (prevP && isProviderUsable(prevP)) return prev;
        return firstUsable ? firstUsable.id : null;
      });
    } catch (err) {
      setState({
        kind: "error",
        message:
          err instanceof Error
            ? err.message
            : "AI 도구 상태를 확인할 수 없습니다.",
      });
    }
  }, []);

  useEffect(() => {
    // mount 시 1회 fetch — load 는 useCallback([]) 이라 사실상 한 번만 실행
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // 어떤 provider 라도 skill 설치 중이거나 본체 설치 중이면 1s 간격 자동 폴링
  useEffect(() => {
    if (state.kind !== "ok") return;
    const anyInstalling = state.providers.some(
      (p) =>
        p.slidesGrabSkill?.status === "installing" ||
        p.bodyInstall?.status === "installing",
    );
    if (!anyInstalling) return;
    const t = setInterval(() => {
      void load();
    }, 1000);
    return () => clearInterval(t);
  }, [state, load]);

  const installSlidesGrabSkill = useCallback(
    async (provider: ProviderId) => {
      try {
        const res = await fetch("/api/providers/skills/install", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }
        // 시작됨 — 즉시 상태 갱신 (installing 보임) + 폴링은 위 effect 가 자동
        await load();
      } catch (err) {
        setState({
          kind: "error",
          message:
            err instanceof Error
              ? err.message
              : "기술 설치를 시작하지 못했어요.",
        });
      }
    },
    [load],
  );

  const installProviderBody = useCallback(
    async (provider: ProviderId) => {
      try {
        const res = await fetch("/api/providers/install", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error ?? "설치를 시작하지 못했어요.");
        }
        await load();
      } catch (err) {
        setState({
          kind: "error",
          message:
            err instanceof Error
              ? err.message
              : "설치를 시작하지 못했어요.",
        });
      }
    },
    [load],
  );

  const anyUsable =
    state.kind === "ok" && state.providers.some(isProviderUsable);

  return (
    <>
      <TopNav active={1} />

      <main className="mx-auto max-w-[920px] px-6 pt-14 pb-20">
        <div>
          <h1 className="m-0 mb-2.5 text-[32px] font-bold leading-tight tracking-[-0.02em]">
            먼저 AI 도구가 설치되어 있는지 확인할게요
          </h1>
          <p className="m-0 mb-9 text-[16px] text-[var(--text-muted)]">
            슬라이드는 AI가 만들어줍니다. 아래 둘 중{" "}
            <b className="text-[var(--text)]">한 개라도 잘 연결</b>되어 있으면 시작할 수 있어요.
          </p>
        </div>

        <div className="my-4 mb-8 rounded-r-[10px] border-l-[3px] border-[var(--primary)] bg-[var(--surface)] py-3.5 pl-4.5 pr-4.5 text-[13.5px] text-[var(--text-muted)]">
          Claude Code 또는 Codex는 사용자 컴퓨터에 직접 설치되는 도구예요. 처음이라면 안내 링크를 눌러 설치 후 이 페이지를 새로고침해 주세요.
        </div>

        {state.kind === "loading" ? (
          <LoadingGrid />
        ) : state.kind === "error" ? (
          <ErrorBox message={state.message} onRetry={load} />
        ) : (
          <div className="mb-8 grid grid-cols-2 gap-4">
            {state.providers.map((p) => (
              <ProviderCard
                key={p.id}
                provider={p}
                selected={selectedId === p.id}
                onSelect={() => setSelectedId(p.id)}
                onInstallSkill={() => installSlidesGrabSkill(p.id)}
                onInstallBody={() => installProviderBody(p.id)}
              />
            ))}
          </div>
        )}

        {state.kind === "ok" ? (
          anyUsable ? (
            <div className="mt-2 flex items-center gap-2 rounded-[10px] border border-[rgba(16,185,129,0.25)] bg-[var(--success-soft)] px-4 py-3 text-[13.5px] font-semibold text-[var(--success)]">
              <span>✓</span>
              <span>
                {selectedId
                  ? `${state.providers.find((p) => p.id === selectedId)?.label}로 슬라이드를 만들 거예요. 다음 단계로 넘어갈 수 있어요.`
                  : "AI 도구가 준비됐어요. 위에서 하나를 골라주세요."}
              </span>
            </div>
          ) : (
            <div className="mt-2 flex items-center gap-2 rounded-[10px] border border-[rgba(239,68,68,0.25)] bg-[var(--danger-soft)] px-4 py-3 text-[13.5px] font-semibold text-[var(--danger)]">
              <span>!</span>
              <span>아직 사용 가능한 도구가 없어요. Claude Code 또는 Codex 중 하나를 먼저 설치한 뒤, 위 카드의 ⚡ 자동 설치 버튼으로 기술까지 더해 주세요.</span>
            </div>
          )
        ) : null}

        <div className="mt-8 flex items-center justify-end gap-3">
          <Link
            href="/"
            className="mr-auto inline-flex items-center gap-2 rounded-[10px] border border-[var(--border)] bg-transparent px-5 py-3 text-[15px] font-semibold text-[var(--text)] no-underline transition-colors hover:bg-[var(--surface-2)] hover:no-underline"
          >
            ← 내 발표 자료
          </Link>
          <button
            type="button"
            onClick={load}
            disabled={state.kind === "loading"}
            className="inline-flex items-center gap-2 rounded-[10px] border border-[var(--border)] bg-transparent px-5 py-3 text-[15px] font-semibold text-[var(--text)] transition-colors hover:bg-[var(--surface-2)] disabled:opacity-50"
          >
            {state.kind === "loading" ? "확인 중…" : "상태 다시 확인"}
          </button>
          {selectedId ? (
            <Link
              href={`/upload?provider=${selectedId}`}
              className="inline-flex items-center gap-2 rounded-[12px] border border-[var(--primary)] bg-[var(--primary)] px-7 py-4 text-[16px] font-semibold text-[var(--primary-foreground)] no-underline transition-colors hover:bg-[var(--primary-hover)] hover:no-underline"
            >
              다음으로 →
            </Link>
          ) : (
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="inline-flex cursor-not-allowed items-center gap-2 rounded-[12px] border border-[var(--primary)] bg-[var(--primary)] px-7 py-4 text-[16px] font-semibold text-[var(--primary-foreground)] opacity-40"
            >
              다음으로 →
            </button>
          )}
        </div>

        <p className="mt-10 text-center text-[12px] text-[var(--text-muted)]">
          현재 <b>macOS</b> 에서만 검증되었어요. (Windows 는 아직 지원하지 않아요)
        </p>
      </main>
    </>
  );
}

function ProviderCard({
  provider,
  selected,
  onSelect,
  onInstallSkill,
  onInstallBody,
}: {
  provider: ProviderStatus;
  selected: boolean;
  onSelect: () => void;
  onInstallSkill: () => void;
  onInstallBody: () => void;
}) {
  const installed = provider.installed;
  const usable = isProviderUsable(provider);
  const skill = provider.slidesGrabSkill;
  const bodyInstall = provider.bodyInstall;
  return (
    <article
      className={
        usable
          ? selected
            ? "relative flex flex-col gap-3.5 rounded-[16px] border-[1.5px] border-[var(--primary)] bg-[var(--surface)] p-6 shadow-[0_0_0_3px_rgba(24,24,27,0.08)]"
            : "relative flex flex-col gap-3.5 rounded-[16px] border-[1.5px] border-[var(--border)] bg-[var(--surface)] p-6 hover:border-[var(--border-strong)]"
          : "relative flex flex-col gap-3.5 rounded-[16px] border-[1.5px] border-[var(--border)] bg-[var(--surface-2)] p-6"
      }
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5 text-[18px] font-bold tracking-[-0.01em]">
          <span
            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-[14px] font-bold text-[var(--primary-foreground)] ${ICON_BG[provider.id]}`}
          >
            {ICON_LABEL[provider.id]}
          </span>
          {provider.label}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 text-[13px]">
        {installed ? (
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[var(--success)]">✓</span>
            <span>
              <b>설치됨</b>
              {provider.version ? ` · 버전 ${provider.version}` : null}
            </span>
          </div>
        ) : bodyInstall?.status === "installing" ? (
          <div className="flex items-center gap-2">
            <span className="inline-block animate-spin font-semibold text-[var(--accent)]">⟳</span>
            <span>
              <b>설치 중…</b>
              <span className="ml-1 text-[var(--text-muted)]">(1~3분)</span>
            </span>
          </div>
        ) : bodyInstall?.status === "failed" ? (
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[var(--danger)]">!</span>
            <span>
              <b>자동 설치 실패</b>
              <span className="ml-1 text-[var(--text-muted)]">— 아래 명령으로 직접 설치해 주세요</span>
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[var(--danger)]">✗</span>
            <span>
              <b>설치 안 됨</b>
            </span>
          </div>
        )}

        {/* slides-grab 기술 상태 — Claude Code 만 의미 있음 (Codex 는 null) */}
        {installed && skill ? (
          <div className="flex items-center gap-2">
            {skill.status === "installed" ? (
              <>
                <span className="font-semibold text-[var(--success)]">✓</span>
                <span>
                  <b>slides-grab 기술 설치됨</b>
                </span>
              </>
            ) : skill.status === "installing" ? (
              <>
                <span className="inline-block animate-spin font-semibold text-[var(--accent)]">⟳</span>
                <span>
                  <b>slides-grab 기술 설치 중…</b>
                  <span className="ml-1 text-[var(--text-muted)]">(1~3분)</span>
                </span>
              </>
            ) : skill.status === "failed" ? (
              <>
                <span className="font-semibold text-[var(--danger)]">!</span>
                <span>
                  <b>설치 실패</b>
                  <span className="ml-1 text-[var(--text-muted)]">— 다시 시도해 주세요</span>
                </span>
              </>
            ) : (
              <>
                <span className="font-semibold text-[var(--danger)]">✗</span>
                <span>
                  <b>slides-grab 기술 안 됨</b>
                </span>
              </>
            )}
          </div>
        ) : null}
      </div>

      <div className="mt-auto flex items-center gap-2">
        {usable ? (
          <label
            className={
              selected
                ? "inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--primary)] bg-[var(--primary)] px-3 py-2 text-[13px] font-medium text-[var(--primary-foreground)]"
                : "inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[13px] font-medium"
            }
          >
            <input
              type="radio"
              name="provider"
              checked={selected}
              onChange={onSelect}
              className="m-0"
            />
            이걸로 사용
          </label>
        ) : !installed && bodyInstall?.status === "installing" ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[13px] font-medium text-[var(--text-muted)]">
            <span className="inline-block animate-spin">⟳</span> 설치 중…
          </span>
        ) : !installed ? (
          <button
            type="button"
            onClick={onInstallBody}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-3 py-2 text-[13px] font-semibold text-white hover:opacity-90"
          >
            {bodyInstall?.status === "failed" ? "⚡ 다시 시도" : "⚡ 자동 설치"}
          </button>
        ) : skill && (skill.status === "missing" || skill.status === "failed") ? (
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={onInstallSkill}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-3 py-2 text-[13px] font-semibold text-white hover:opacity-90"
            >
              ⚡ 자동 설치
            </button>
            {provider.id === "claude-code" ? (
              <span className="text-[11.5px] text-[var(--text-muted)]">
                처음이면 터미널에서 <code className="rounded bg-[var(--surface-2)] px-1 py-[1px] font-mono text-[11px]">claude</code> 한 번 실행해서 로그인 후
              </span>
            ) : null}
          </div>
        ) : skill?.status === "installing" ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[13px] font-medium text-[var(--text-muted)]">
            <span className="inline-block animate-spin">⟳</span> 설치 중…
          </span>
        ) : null}
      </div>

      {/* 본체 설치 실패 시 — 사용자가 직접 터미널에서 설치할 수 있는 명령 안내 */}
      {!installed && bodyInstall?.status === "failed" ? (
        <>
          <div className="mt-1 rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3.5 font-mono text-[12.5px] text-[var(--text)]">
            # 터미널에서 한 줄 실행
            <br />
            {provider.installCommand}
            <br />
            <br />
            설치가 끝나면 “상태 다시 확인” 을 눌러주세요.
          </div>
          {bodyInstall.error ? (
            <div className="mt-1 rounded-[10px] border border-[rgba(239,68,68,0.25)] bg-[var(--danger-soft)] px-3.5 py-2.5 font-mono text-[11.5px] text-[#991b1b]">
              {bodyInstall.error}
            </div>
          ) : null}
        </>
      ) : null}

      {/* skill 설치 실패 에러 자세히 */}
      {skill?.status === "failed" && skill.error ? (
        <div className="mt-1 rounded-[10px] border border-[rgba(239,68,68,0.25)] bg-[var(--danger-soft)] px-3.5 py-2.5 font-mono text-[11.5px] text-[#991b1b]">
          {skill.error}
        </div>
      ) : null}
    </article>
  );
}

// provider 가 "이걸로 사용" 가능한지 — Claude Code 는 skill 까지 OK 일 때만, Codex 는 installed 만
function isProviderUsable(p: ProviderStatus): boolean {
  if (!p.installed) return false;
  if (p.id === "claude-code") {
    return p.slidesGrabSkill?.status === "installed";
  }
  return true;
}

function LoadingGrid() {
  return (
    <div className="mb-8 grid grid-cols-2 gap-4">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="flex h-[200px] animate-pulse flex-col gap-3.5 rounded-[16px] border-[1.5px] border-[var(--border)] bg-[var(--surface-2)] p-6"
        >
          <div className="h-6 w-32 rounded bg-[var(--border)]" />
          <div className="h-4 w-44 rounded bg-[var(--border)]" />
        </div>
      ))}
    </div>
  );
}

function ErrorBox({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="mb-8 flex flex-col gap-3 rounded-[16px] border border-[rgba(239,68,68,0.25)] bg-[var(--danger-soft)] p-6 text-[14px] text-[var(--danger)]">
      <div className="font-semibold">AI 도구 상태를 확인하지 못했어요</div>
      <div className="text-[var(--text-muted)]">{message}</div>
      <div>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[13.5px] font-semibold text-[var(--text)] hover:bg-[var(--surface-2)]"
        >
          다시 시도
        </button>
      </div>
    </div>
  );
}
