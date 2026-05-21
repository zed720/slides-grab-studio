"use client";

import { useCallback, useEffect, useState } from "react";

export type ExportFormat = "pdf" | "png" | "pptx" | "figma";

// 모달 phase — parent (DeckPage) 가 보유. 모달이 unmount 돼도 polling 계속
// 되도록 phase 자체를 외부에서 관리.
export type ExportPhase =
  | { kind: "idle" } // 아직 열린 적 없음 / 닫힘 후
  | { kind: "select" }
  | { kind: "starting"; format: ExportFormat }
  | { kind: "running"; jobId: string; format: ExportFormat }
  | {
      kind: "done";
      jobId: string;
      format: ExportFormat;
      filename: string;
      sizeBytes: number;
      downloadUrl: string;
    }
  | { kind: "failed"; format: ExportFormat; error: string };

type OptionDef = {
  format: ExportFormat;
  name: string;
  pill?: "rec" | "beta" | "soon";
  desc: string;
  disabled?: boolean;
};

const OPTIONS: readonly OptionDef[] = [
  {
    format: "pdf",
    name: "PDF 문서",
    pill: "rec",
    desc: "한 장씩 보거나 인쇄, 이메일 첨부에 가장 잘 맞아요. 모든 슬라이드가 한 파일로 합쳐집니다.",
  },
  {
    format: "png",
    name: "이미지 묶음 (PNG)",
    pill: "soon",
    desc: "슬라이드 한 장당 PNG 이미지 한 장. 곧 지원될 예정이에요. (지금은 슬라이드 만드는 도구 쪽에서 잠시 제외됨)",
    disabled: true,
  },
  {
    format: "pptx",
    name: "파워포인트 (PPTX)",
    pill: "beta",
    desc: "파워포인트에서 다시 편집할 수 있는 파일. 아직 글자나 위치가 조금 어긋날 수 있어요. 발표용으로는 PDF 를 권합니다.",
  },
  {
    format: "figma",
    name: "Figma Slides 용 (PPTX)",
    pill: "beta",
    desc: "Figma Slides 의 Import 메뉴로 불러와 다시 편집할 수 있는 파일. 디자인에 따라 변환이 아예 안 되는 경우가 있어요 (배경 이미지가 많은 템플릿 등). 발표용은 PDF, 편집은 위의 PPTX 를 권장합니다.",
  },
] as const;

type Props = {
  deckId: string;
  phase: ExportPhase;
  onPhaseChange: (p: ExportPhase) => void;
  onClose: () => void;
};

export function ExportModal({ deckId, phase, onPhaseChange, onClose }: Props) {
  // 옵션 선택 단계의 라디오 — 이전에 진행한 format 이 있으면 그걸로 시작
  const initialChosen: ExportFormat =
    phase.kind === "running" ||
    phase.kind === "starting" ||
    phase.kind === "done" ||
    phase.kind === "failed"
      ? phase.format
      : "pdf";
  const [chosen, setChosen] = useState<ExportFormat>(initialChosen);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phase.kind !== "starting") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, phase.kind]);

  const start = useCallback(
    async (fmt: ExportFormat) => {
      onPhaseChange({ kind: "starting", format: fmt });
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
        onPhaseChange({ kind: "running", jobId: data.jobId, format: fmt });
      } catch (err) {
        onPhaseChange({
          kind: "failed",
          format: fmt,
          error:
            err instanceof Error
              ? err.message
              : "내보내기를 시작하지 못했어요.",
        });
      }
    },
    [deckId, onPhaseChange],
  );

  const closing = phase.kind !== "starting";

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-6 backdrop-blur-sm"
      onClick={() => closing && onClose()}
    >
      <div
        className="flex w-full max-w-[560px] max-h-[90vh] flex-col overflow-hidden rounded-[16px] bg-[var(--surface)] shadow-[var(--shadow-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalHead onClose={closing ? onClose : undefined} />

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {phase.kind === "select" || phase.kind === "starting" ? (
            <SelectBody
              chosen={chosen}
              onChoose={setChosen}
              disabled={phase.kind === "starting"}
            />
          ) : null}

          {phase.kind === "running" ? <RunningBody format={phase.format} /> : null}

          {phase.kind === "done" ? (
            <DoneBody
              filename={phase.filename}
              sizeBytes={phase.sizeBytes}
              downloadUrl={phase.downloadUrl}
            />
          ) : null}

          {phase.kind === "failed" ? <FailedBody error={phase.error} /> : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-4">
          {phase.kind === "select" ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="rounded-[10px] border border-[var(--border)] bg-transparent px-4 py-2 text-[13.5px] font-medium text-[var(--text)] hover:bg-[var(--surface-2)]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => start(chosen)}
                className="rounded-[10px] border border-[var(--accent)] bg-[var(--accent)] px-5 py-2 text-[13.5px] font-semibold text-white hover:opacity-90"
              >
                ⬇ 만들기 시작
              </button>
            </>
          ) : null}

          {phase.kind === "starting" ? (
            <button
              type="button"
              disabled
              className="rounded-[10px] border border-[var(--accent)] bg-[var(--accent)] px-5 py-2 text-[13.5px] font-semibold text-white opacity-60"
            >
              시작하는 중…
            </button>
          ) : null}

          {phase.kind === "running" ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-[10px] border border-[var(--border)] bg-transparent px-4 py-2 text-[13.5px] font-medium text-[var(--text)] hover:bg-[var(--surface-2)]"
            >
              닫기 (계속 진행)
            </button>
          ) : null}

          {phase.kind === "done" ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="rounded-[10px] border border-[var(--border)] bg-transparent px-4 py-2 text-[13.5px] font-medium text-[var(--text)] hover:bg-[var(--surface-2)]"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={() => onPhaseChange({ kind: "select" })}
                className="rounded-[10px] border border-[var(--accent)] bg-[var(--accent)] px-5 py-2 text-[13.5px] font-semibold text-white hover:opacity-90"
              >
                다른 형식도 만들기
              </button>
            </>
          ) : null}

          {phase.kind === "failed" ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="rounded-[10px] border border-[var(--border)] bg-transparent px-4 py-2 text-[13.5px] font-medium text-[var(--text)] hover:bg-[var(--surface-2)]"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={() => start(phase.format)}
                className="rounded-[10px] border border-[var(--accent)] bg-[var(--accent)] px-5 py-2 text-[13.5px] font-semibold text-white hover:opacity-90"
              >
                다시 시도
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ModalHead({ onClose }: { onClose?: () => void }) {
  return (
    <div className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-4">
      <span className="text-[16px] font-bold tracking-[-0.01em]">
        ⬇ 내보내기
      </span>
      <div className="flex-1" />
      <button
        type="button"
        onClick={onClose}
        disabled={!onClose}
        aria-label="닫기"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[15px] text-[var(--text-muted)] hover:bg-[var(--surface-2)] disabled:opacity-40"
      >
        ✕
      </button>
    </div>
  );
}

function SelectBody({
  chosen,
  onChoose,
  disabled,
}: {
  chosen: ExportFormat;
  onChoose: (f: ExportFormat) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {OPTIONS.map((opt) => {
        const isSelected = chosen === opt.format;
        const isLocked = !!opt.disabled;
        const cardClass = isLocked
          ? "flex items-start gap-3.5 rounded-[12px] border-[1.5px] border-[var(--border)] bg-[var(--surface-2)] px-4 py-3.5 text-left opacity-60 cursor-not-allowed"
          : isSelected
            ? "flex items-start gap-3.5 rounded-[12px] border-[1.5px] border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-3.5 text-left shadow-[0_0_0_3px_rgba(37,99,235,0.08)] disabled:opacity-60"
            : "flex items-start gap-3.5 rounded-[12px] border-[1.5px] border-[var(--border)] bg-[var(--surface)] px-4 py-3.5 text-left hover:border-[var(--border-strong)] disabled:opacity-60";
        return (
          <button
            key={opt.format}
            type="button"
            onClick={() => !isLocked && onChoose(opt.format)}
            disabled={disabled || isLocked}
            aria-disabled={isLocked || undefined}
            className={cardClass}
          >
            <span
              className={
                "relative mt-0.5 inline-block h-[18px] w-[18px] flex-shrink-0 rounded-full border-2 " +
                (isSelected && !isLocked
                  ? "border-[var(--accent)]"
                  : "border-[var(--border-strong)]")
              }
            >
              {isSelected && !isLocked ? (
                <span className="absolute inset-[3px] rounded-full bg-[var(--accent)]" />
              ) : null}
            </span>
            <span className="flex-1">
              <span className="mb-1 flex items-center gap-2">
                <span className="text-[14.5px] font-bold tracking-[-0.005em]">
                  {opt.name}
                </span>
                {opt.pill === "rec" ? (
                  <span className="rounded-full border border-[rgba(16,185,129,0.25)] bg-[var(--success-soft)] px-1.5 py-[1px] text-[10.5px] font-bold tracking-[0.02em] text-[var(--success)]">
                    권장
                  </span>
                ) : null}
                {opt.pill === "beta" ? (
                  <span className="rounded-full border border-[#fde68a] bg-[#fef3c7] px-1.5 py-[1px] text-[10.5px] font-bold tracking-[0.02em] text-[#92400e]">
                    베타
                  </span>
                ) : null}
                {opt.pill === "soon" ? (
                  <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-1.5 py-[1px] text-[10.5px] font-bold tracking-[0.02em] text-[var(--text-muted)]">
                    준비 중
                  </span>
                ) : null}
              </span>
              <span className="block text-[12.5px] leading-[1.5] text-[var(--text-muted)]">
                {opt.desc}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function RunningBody({ format }: { format: ExportFormat }) {
  return (
    <div className="px-1 py-2 text-center">
      <div
        className="mx-auto mb-4 h-11 w-11 rounded-full border-[3px] border-[var(--surface-2)]"
        style={{
          borderTopColor: "var(--accent)",
          animation: "exp-spin 0.9s linear infinite",
        }}
      />
      <style>{`@keyframes exp-spin { to { transform: rotate(360deg); } }`}</style>
      <div className="mb-1.5 text-[15px] font-bold tracking-[-0.005em]">
        {formatLabel(format)} 만드는 중…
      </div>
      <div className="mb-4 text-[13px] text-[var(--text-muted)]">
        보통 30초~몇 분 정도 걸려요. 모달을 닫아도 백그라운드에서 계속 진행됩니다.
      </div>
      <div className="mx-auto max-w-[380px] overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface-2)]">
        <span
          className="block h-2 rounded-full bg-gradient-to-r from-[var(--accent)] to-[#60a5fa]"
          style={{
            width: "33%",
            animation: "exp-indeterminate 1.4s ease-in-out infinite",
            position: "relative",
          }}
        />
      </div>
      <style>{`
        @keyframes exp-indeterminate {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
}

function DoneBody({
  filename,
  sizeBytes,
  downloadUrl,
}: {
  filename: string;
  sizeBytes: number;
  downloadUrl: string;
}) {
  return (
    <div className="px-1 py-2 text-center">
      <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full border-[1.5px] border-[rgba(16,185,129,0.3)] bg-[var(--success-soft)] text-[28px] font-bold text-[var(--success)]">
        ✓
      </div>
      <div className="mb-1.5 text-[15px] font-bold tracking-[-0.005em]">
        파일이 준비됐어요
      </div>
      <div className="mb-2 font-mono text-[12.5px] text-[var(--text-muted)] break-all px-2">
        {filename}
      </div>
      <div className="mb-4 inline-flex gap-3.5 text-[12px] text-[var(--text-muted)]">
        <span>
          <b className="text-[var(--text)]">{formatSize(sizeBytes)}</b>
        </span>
      </div>
      <div>
        <a
          href={downloadUrl}
          download={filename}
          className="inline-flex items-center gap-2 rounded-[10px] border border-[var(--success)] bg-[var(--success)] px-5 py-2.5 text-[14px] font-semibold text-white no-underline hover:opacity-90 hover:no-underline"
        >
          ⬇ 다운로드
        </a>
      </div>
    </div>
  );
}

function FailedBody({ error }: { error: string }) {
  return (
    <div className="px-1 py-2 text-center">
      <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full border-[1.5px] border-[rgba(239,68,68,0.3)] bg-[var(--danger-soft)] text-[30px] font-bold text-[var(--danger)]">
        !
      </div>
      <div className="mb-1.5 text-[15px] font-bold tracking-[-0.005em]">
        파일을 만들지 못했어요
      </div>
      <div className="mb-3 text-[13px] text-[var(--text-muted)]">
        잠시 후 다시 시도하거나, 다른 형식 (PDF 권장) 으로 받아 보세요.
      </div>
      <div className="mx-auto mt-2 max-w-[440px] rounded-[10px] border border-[rgba(239,68,68,0.25)] bg-[var(--danger-soft)] px-3.5 py-2.5 text-left font-mono text-[12px] text-[#991b1b] break-all">
        {error}
      </div>
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

function formatSize(bytes: number): string {
  if (!bytes) return "0 KB";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}
