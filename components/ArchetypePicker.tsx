"use client";

import type { ArchetypeMap, BrandKit } from "@/lib/custom-templates/types";
import { ARCHETYPES } from "@/lib/custom-templates/archetypes";

type Props = {
  brand: BrandKit;
  archetypes: ArchetypeMap;
  onChange: (next: ArchetypeMap) => void;
};

export function ArchetypePicker({ brand, archetypes, onChange }: Props) {
  return (
    <div className="flex flex-col gap-6">
      {ARCHETYPES.map((meta) => {
        const currentChoice = archetypes[meta.key] ?? null;
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
            </div>

            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
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
                      <iframe
                        title={`${meta.label} ${opt.name}`}
                        srcDoc={html}
                        sandbox=""
                        className="block h-full w-full border-0"
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
          </div>
        );
      })}
    </div>
  );
}
