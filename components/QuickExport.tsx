"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ExportFormat, ExportPhase } from "@/components/ExportModal";

// 라이브러리 카드의 *빠른 다운로드* — 카드 안에서 모든 게 일어난다.
//   ⬇ 버튼 (우하단) → 형식 메뉴 popover → 진행/완료/실패 overlay → 자동 다운로드.
// deck 페이지의 ExportModal 과 같은 API 를 쓰지만 UI 는 별개 (mini overlay).

type Props = {
  deckId: string;
};

// 메뉴 옵션 — ExportModal 과 동일한 라벨/잠금 상태 유지
const MENU: { format: ExportFormat; label: string; pill?: "rec" | "beta" | "soon"; disabled?: boolean }[] = [
  { format: "pdf",   label: "PDF 문서",         pill: "rec" },
  { format: "png",   label: "이미지 묶음",       pill: "soon", disabled: true },
  { format: "pptx",  label: "파워포인트",        pill: "beta" },
  { format: "figma", label: "Figma Slides",     pill: "beta" },
];

export function QuickExport({ deckId }: Props) {
  const [phase, setPhase] = useState<ExportPhase>({ kind: "idle" });
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // 메뉴 열렸을 때 외부 클릭으로 닫기
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  // 진행 중일 때 polling — ExportModal 과 같은 패턴
  useEffect(() => {
    if (phase.kind !== "running") return;
    const jobId = phase.jobId;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/decks/${deckId}/export/${jobId}`, {
          cache: "no-store",
        });
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
          setPhase({
            kind: "done",
            jobId,
            format: data.format,
            filename: data.filename,
            sizeBytes: data.sizeBytes ?? 0,
            downloadUrl: data.downloadUrl,
          });
        } else if (data.status === "failed") {
          setPhase({
            kind: "failed",
            format: data.format,
            error: data.error ?? "내보내기에 실패했어요.",
          });
        } else {
          timer = setTimeout(tick, 1000);
        }
      } catch {
        if (cancelled) return;
        timer = setTimeout(tick, 1500);
      }
    };
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [phase, deckId]);

  // 완료 시 자동 다운로드 trigger (한 번만)
  const triggeredRef = useRef<string | null>(null);
  useEffect(() => {
    if (phase.kind !== "done") return;
    if (triggeredRef.current === phase.jobId) return;
    triggeredRef.current = phase.jobId;
    const a = document.createElement("a");
    a.href = phase.downloadUrl;
    a.download = phase.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [phase]);

  const onPickFormat = useCallback(
    async (fmt: ExportFormat) => {
      setMenuOpen(false);
      setPhase({ kind: "starting", format: fmt });
      try {
        const res = await fetch(`/api/decks/${deckId}/export`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ format: fmt }),
        });
        const data = (await res.json().catch(() => null)) as {
          jobId?: string;
          error?: string;
        } | null;
        if (!res.ok || !data?.jobId) {
          throw new Error(data?.error ?? `HTTP ${res.status}`);
        }
        setPhase({ kind: "running", jobId: data.jobId, format: fmt });
      } catch (err) {
        setPhase({
          kind: "failed",
          format: fmt,
          error:
            err instanceof Error
              ? err.message
              : "내보내기를 시작하지 못했어요.",
        });
      }
    },
    [deckId],
  );

  // overlay 닫기 (완료/실패 → idle 로 복귀)
  const dismissOverlay = useCallback(() => setPhase({ kind: "idle" }), []);

  return (
    <div ref={rootRef} className="contents">
      {phase.kind === "idle" ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
          aria-label="빠른 다운로드"
          title="빠른 다운로드"
          className="absolute bottom-2 right-2 z-[5] inline-flex h-[34px] w-[34px] items-center justify-center rounded-[10px] border-[1.5px] border-[var(--border)] bg-white/95 text-[15px] font-bold text-[var(--success)] shadow-[0_2px_8px_rgba(0,0,0,0.10)] transition-colors hover:border-[var(--success)] hover:bg-[var(--success-soft)]"
        >
          ⬇
        </button>
      ) : null}

      {menuOpen && phase.kind === "idle" ? (
        <div
          className="absolute bottom-[50px] right-2 z-[6] w-[220px] rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-[var(--shadow-lg)]"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <div className="px-2.5 pb-1.5 pt-2 text-[11.5px] font-bold uppercase tracking-[0.04em] text-[var(--text-muted)]">
            어떤 형식으로 받을까요?
          </div>
          {MENU.map((it) => (
            <button
              key={it.format}
              type="button"
              disabled={it.disabled}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!it.disabled) onPickFormat(it.format);
              }}
              className={
                it.disabled
                  ? "flex w-full cursor-not-allowed items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-[var(--text-soft)] opacity-70"
                  : "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-[var(--text)] hover:bg-[var(--surface-2)]"
              }
            >
              <span className="flex-1">{it.label}</span>
              {it.pill === "rec" ? (
                <span className="rounded-full border border-[rgba(16,185,129,0.25)] bg-[var(--success-soft)] px-1.5 py-px text-[10px] font-bold text-[var(--success)]">
                  권장
                </span>
              ) : null}
              {it.pill === "beta" ? (
                <span className="rounded-full border border-[#fde68a] bg-[#fef3c7] px-1.5 py-px text-[10px] font-bold text-[#92400e]">
                  베타
                </span>
              ) : null}
              {it.pill === "soon" ? (
                <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-1.5 py-px text-[10px] font-bold text-[var(--text-muted)]">
                  준비 중
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      {phase.kind === "starting" || phase.kind === "running" ? (
        <Overlay onClick={(e) => e.preventDefault()}>
          <span
            className="h-7 w-7 rounded-full border-[3px] border-[var(--surface-2)]"
            style={{
              borderTopColor: "var(--accent)",
              animation: "qe-spin 0.9s linear infinite",
            }}
          />
          <style>{`@keyframes qe-spin { to { transform: rotate(360deg); } }`}</style>
          <span className="text-[13.5px] font-bold tracking-[-0.005em]">
            {formatLabel(phase.format)} 만드는 중…
          </span>
          <span className="text-[11.5px] text-[var(--text-muted)]">
            보통 30초~몇 분
          </span>
        </Overlay>
      ) : null}

      {phase.kind === "done" ? (
        <Overlay
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            dismissOverlay();
          }}
        >
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border-[1.5px] border-[rgba(16,185,129,0.3)] bg-[var(--success-soft)] text-[20px] font-bold text-[var(--success)]">
            ✓
          </span>
          <span className="text-[13.5px] font-bold tracking-[-0.005em]">
            {formatLabel(phase.format)} 가 준비됐어요
          </span>
          <span className="text-[11.5px] text-[var(--text-muted)]">
            자동으로 다운로드가 시작돼요
          </span>
          <a
            href={phase.downloadUrl}
            download={phase.filename}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 rounded-[8px] border border-[var(--success)] bg-[var(--success)] px-3 py-1.5 text-[12.5px] font-semibold text-white no-underline hover:opacity-90 hover:no-underline"
          >
            ⬇ 다시 받기
          </a>
        </Overlay>
      ) : null}

      {phase.kind === "failed" ? (
        <Overlay
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            dismissOverlay();
          }}
        >
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border-[1.5px] border-[rgba(239,68,68,0.3)] bg-[var(--danger-soft)] text-[20px] font-bold text-[var(--danger)]">
            !
          </span>
          <span className="text-[13.5px] font-bold tracking-[-0.005em]">
            파일을 만들지 못했어요
          </span>
          <span className="text-[11.5px] text-[var(--text-muted)]">
            다른 형식으로 시도해 보세요
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onPickFormat(phase.format);
            }}
            className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[12px] font-semibold text-[var(--text)] hover:bg-[var(--surface-2)]"
          >
            다시 시도
          </button>
        </Overlay>
      ) : null}
    </div>
  );
}

function Overlay({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onClick={onClick}
      className="absolute inset-x-0 top-0 z-[7] flex aspect-video flex-col items-center justify-center gap-2 bg-white/92 p-4 text-center backdrop-blur-[2px]"
    >
      {children}
    </div>
  );
}

function formatLabel(f: ExportFormat): string {
  switch (f) {
    case "pdf":
      return "PDF";
    case "png":
      return "이미지 묶음";
    case "pptx":
      return "파워포인트";
    case "figma":
      return "Figma Slides 용 파일";
  }
}
