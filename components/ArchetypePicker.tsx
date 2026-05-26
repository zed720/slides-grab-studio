"use client";

import { useState } from "react";
import type {
  AIArchetypeEntry,
  ArchetypeKey,
  ArchetypeMap,
  BrandKit,
} from "@/lib/custom-templates/types";
import { ARCHETYPES } from "@/lib/custom-templates/archetypes";
import { ScaledSlideFrame } from "./ScaledSlideFrame";

type Props = {
  templateId: string;
  brand: BrandKit;
  archetypes: ArchetypeMap;
  onChange: (next: ArchetypeMap) => void;
  // AI 가 새 옵션 만들면 부모가 brand.aiArchetypes 에 append.
  onAIGenerated: (entries: AIArchetypeEntry[]) => void;
  // AI 옵션 삭제 시 부모가 brand 에서 제거.
  onAIDeleted: (archKey: ArchetypeKey, entryId: string) => void;
};

// 자주 쓰는 요청 칩 (multi-select). archetype 종류 무관하게 공통.
const COMMON_CHIPS = [
  "🏢 우리 브랜드 적용",
  "더 단순하게",
  "숫자 강조",
  "여백 넓게",
  "한 줄로 짧게",
];

export function ArchetypePicker({
  templateId,
  brand,
  archetypes,
  onChange,
  onAIGenerated,
  onAIDeleted,
}: Props) {
  const [openPanel, setOpenPanel] = useState<ArchetypeKey | null>(null);
  const [promptText, setPromptText] = useState("");
  const [activeChips, setActiveChips] = useState<string[]>([
    "🏢 우리 브랜드 적용",
  ]);
  const [count, setCount] = useState(2);
  const [generating, setGenerating] = useState<ArchetypeKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const togglePanel = (key: ArchetypeKey) => {
    if (openPanel === key) {
      setOpenPanel(null);
    } else {
      setOpenPanel(key);
      setPromptText("");
      setActiveChips(["🏢 우리 브랜드 적용"]);
      setCount(2);
      setError(null);
    }
  };

  const toggleChip = (chip: string) => {
    setActiveChips((cur) =>
      cur.includes(chip) ? cur.filter((c) => c !== chip) : [...cur, chip],
    );
  };

  const submitGeneration = async (archKey: ArchetypeKey) => {
    setError(null);
    setGenerating(archKey);
    try {
      const res = await fetch(
        `/api/my-templates/${templateId}/archetypes/generate`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            archKey,
            prompt: promptText,
            chips: activeChips,
            count,
          }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? `AI 생성에 실패했어요. (${res.status})`);
      }
      const data = (await res.json()) as { entries: AIArchetypeEntry[] };
      onAIGenerated(data.entries);
      setPromptText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI 생성에 실패했어요.");
    } finally {
      setGenerating(null);
    }
  };

  const deleteAI = async (archKey: ArchetypeKey, entry: AIArchetypeEntry) => {
    if (!confirm(`AI 가 만든 옵션 "${entry.name}" 을 지울까요?`)) return;
    try {
      const res = await fetch(
        `/api/my-templates/${templateId}/archetypes/${archKey}/${entry.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error(`삭제 실패 (${res.status})`);
      onAIDeleted(archKey, entry.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "삭제에 실패했어요.");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {ARCHETYPES.map((meta) => {
        const currentChoice = archetypes[meta.key] ?? null;
        const isOpen = openPanel === meta.key;
        const isGenerating = generating === meta.key;
        const aiOptions = brand.aiArchetypes?.[meta.key] ?? [];

        return (
          <div
            key={meta.key}
            className="border-t border-[var(--border)] pt-5 first:border-t-0 first:pt-0"
          >
            <div className="mb-3 flex items-center gap-3">
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[14px]">
                {meta.icon}
              </div>
              <div className="flex-1">
                <div className="text-[15px] font-bold tracking-[-0.005em]">
                  {meta.label}
                </div>
                <div className="text-[12.5px] text-[var(--text-muted)]">
                  {meta.description}
                </div>
              </div>
              {currentChoice ? (
                <button
                  type="button"
                  onClick={() =>
                    onChange({ ...archetypes, [meta.key]: null })
                  }
                  className="rounded px-2 py-1 text-[12px] text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                >
                  다시 안 고름
                </button>
              ) : (
                <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-0.5 text-[11.5px] font-semibold text-[var(--text-muted)]">
                  아직 안 골랐음
                </span>
              )}
              <button
                type="button"
                onClick={() => togglePanel(meta.key)}
                className={
                  isOpen
                    ? "inline-flex items-center gap-1.5 rounded-md border border-[var(--accent)] bg-[var(--accent)] px-2.5 py-1 text-[12px] font-semibold text-white"
                    : "inline-flex items-center gap-1.5 rounded-md border border-[#dbeafe] bg-[var(--accent-soft)] px-2.5 py-1 text-[12px] font-semibold text-[var(--accent)] hover:bg-[#dbeafe]"
                }
                title="Claude 토큰 사용 · 약 1~2분"
              >
                🪄 {isOpen ? "닫기" : "새 모양 만들기"}
              </button>
            </div>

            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
              {/* AI 옵션 — 정적 옵션 앞에 배치 (사용자가 직접 만든 거니 우선 노출) */}
              {aiOptions.map((entry) => {
                const selected = currentChoice === entry.id;
                return (
                  <div
                    key={entry.id}
                    className={
                      selected
                        ? "group relative overflow-hidden rounded-[10px] border-2 border-[var(--primary)] bg-white text-left shadow-[0_0_0_3px_rgba(24,24,27,0.08)] transition-all"
                        : "group relative overflow-hidden rounded-[10px] border-2 border-[var(--border)] bg-white text-left transition-all hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-md"
                    }
                  >
                    <span className="absolute left-1.5 top-1.5 z-[2] inline-flex items-center gap-1 rounded bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white shadow-sm">
                      🪄 AI
                    </span>
                    {selected ? (
                      <span className="absolute right-1.5 top-1.5 z-[2] inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[var(--primary)] text-[11px] font-bold text-[var(--primary-foreground)] shadow-md">
                        ✓
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() =>
                        onChange({ ...archetypes, [meta.key]: entry.id })
                      }
                      className="block w-full text-left"
                    >
                      <div className="aspect-video w-full overflow-hidden bg-white">
                        <ScaledSlideFrame
                          title={`${meta.label} ${entry.name}`}
                          srcDoc={entry.html}
                          lazy
                        />
                      </div>
                      <div className="border-t border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[12.5px]">
                        <div className="truncate font-semibold">
                          {entry.name}
                        </div>
                        <div className="truncate text-[var(--text-muted)]">
                          {entry.description}
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteAI(meta.key, entry)}
                      className="absolute bottom-2 right-2 z-[3] inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/90 text-[12px] text-[var(--text-muted)] opacity-0 shadow-sm transition-opacity hover:bg-white hover:text-[var(--danger)] group-hover:opacity-100"
                      aria-label="AI 옵션 삭제"
                      title="이 AI 옵션 지우기"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}

              {/* 정적 옵션 */}
              {meta.options.map((opt) => {
                const selected = currentChoice === opt.id;
                const html = opt.render(brand, {});
                return (
                  <button
                    type="button"
                    key={opt.id}
                    onClick={() =>
                      onChange({ ...archetypes, [meta.key]: opt.id })
                    }
                    className={
                      selected
                        ? "group relative overflow-hidden rounded-[10px] border-2 border-[var(--primary)] bg-white text-left shadow-[0_0_0_3px_rgba(24,24,27,0.08)] transition-all"
                        : "group relative overflow-hidden rounded-[10px] border-2 border-[var(--border)] bg-white text-left transition-all hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-md"
                    }
                  >
                    {selected ? (
                      <span className="absolute right-1.5 top-1.5 z-[2] inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[var(--primary)] text-[11px] font-bold text-[var(--primary-foreground)] shadow-md">
                        ✓
                      </span>
                    ) : null}
                    <div className="aspect-video w-full overflow-hidden bg-white">
                      <ScaledSlideFrame
                        title={`${meta.label} ${opt.name}`}
                        srcDoc={html}
                        lazy
                      />
                    </div>
                    <div className="border-t border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[12.5px]">
                      <div className="font-semibold">
                        {opt.id} · {opt.name}
                      </div>
                      <div className="text-[var(--text-muted)]">
                        {opt.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* AI 생성 panel — 열려있을 때만 */}
            {isOpen ? (
              <div className="mt-4 overflow-hidden rounded-xl border border-[#c7d9f5] bg-gradient-to-b from-[#f8faff] to-white shadow-[0_4px_16px_rgba(37,99,235,0.08)]">
                <div className="flex items-center gap-2.5 border-b border-[#dbeafe] bg-white/70 px-4 py-3">
                  <span className="text-[13.5px] font-bold tracking-[-0.005em] text-[var(--accent)]">
                    🪄 새 {meta.label} 모양 만들기
                  </span>
                  <span className="text-[11.5px] text-[var(--text-muted)]">
                    우리 브랜드 색·로고 자동 적용
                  </span>
                </div>
                <div className="p-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[12.5px] font-semibold">
                      어떤 느낌으로 만들까요?
                      <span className="ml-1 text-[10.5px] font-medium text-[var(--text-soft)]">
                        선택 — 비워두면 일반 모양 {count}종
                      </span>
                    </label>
                    <textarea
                      value={promptText}
                      onChange={(e) => setPromptText(e.target.value)}
                      placeholder={`예: ${
                        meta.key === "cover"
                          ? "로고를 더 크게, 가운데 정렬로"
                          : meta.key === "chart"
                            ? "원형 그래프로 비율 강조"
                            : "더 단순하게, 색은 두 가지로만"
                      }`}
                      className="min-h-[56px] resize-y rounded-lg border-[1.5px] border-[var(--border)] bg-white px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)]"
                      maxLength={500}
                      disabled={isGenerating}
                    />
                  </div>

                  <div className="mt-3">
                    <span className="mb-1.5 block text-[12px] text-[var(--text-muted)]">
                      자주 쓰는 요청 (선택, 여러 개 가능)
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {COMMON_CHIPS.map((chip) => {
                        const active = activeChips.includes(chip);
                        const isBrand = chip.startsWith("🏢");
                        return (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => toggleChip(chip)}
                            disabled={isGenerating}
                            className={
                              active
                                ? isBrand
                                  ? "rounded-full border border-[#b45309] bg-[#b45309] px-2.5 py-1 text-[12px] font-semibold text-white disabled:opacity-40"
                                  : "rounded-full border border-[var(--accent)] bg-[var(--accent)] px-2.5 py-1 text-[12px] font-semibold text-white disabled:opacity-40"
                                : isBrand
                                  ? "rounded-full border border-[#fde68a] bg-[#fff8e1] px-2.5 py-1 text-[12px] font-medium text-[#b45309] hover:bg-[#fde68a] disabled:opacity-40"
                                  : "rounded-full border border-[#dbeafe] bg-white px-2.5 py-1 text-[12px] font-medium text-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:opacity-40"
                            }
                          >
                            {chip}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-dashed border-[#dbeafe] pt-3">
                    <label className="inline-flex items-center gap-1.5 text-[13px]">
                      한 번에 만들 개수
                      <select
                        value={count}
                        onChange={(e) => setCount(Number(e.target.value))}
                        disabled={isGenerating}
                        className="rounded-md border-[1.5px] border-[var(--border)] bg-white px-2 py-1 text-[13px] disabled:opacity-40"
                      >
                        <option value={1}>1 개</option>
                        <option value={2}>2 개</option>
                        <option value={3}>3 개</option>
                      </select>
                    </label>
                    <span className="text-[11.5px] text-[var(--text-muted)]">
                      ⏱ 약 1~2분 · Claude 토큰 약 3,000~5,000
                    </span>
                    <button
                      type="button"
                      onClick={() => void submitGeneration(meta.key)}
                      disabled={isGenerating}
                      className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] px-4 py-2 text-[13.5px] font-bold text-white hover:bg-[#1d4ed8] disabled:opacity-40"
                    >
                      {isGenerating ? "🪄 만드는 중…" : "🪄 만들기 →"}
                    </button>
                  </div>

                  {error ? (
                    <div className="mt-3 rounded-md border border-[rgba(239,68,68,0.25)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] font-semibold text-[var(--danger)]">
                      {error}
                    </div>
                  ) : null}

                  {isGenerating ? (
                    <div className="mt-3 rounded-md border border-[#dbeafe] bg-white px-3 py-2 text-[12.5px] text-[var(--text-muted)]">
                      Claude 가 모양을 만들고 있어요… 끝나면 위 갤러리에 추가돼요.
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
