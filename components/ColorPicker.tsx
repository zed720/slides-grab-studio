"use client";

import { useEffect, useId, useState } from "react";

type Props = {
  label: string;
  value: string; // "#RRGGBB"
  onChange: (hex: string) => void;
  presets: string[]; // hex 6개
  recents?: string[]; // hex 0-3개
  hint?: string;
};

function normalize(h: string): string | null {
  const s = h.trim();
  if (!/^#?[0-9a-f]{6}$/i.test(s)) return null;
  return ("#" + s.replace(/^#/, "")).toUpperCase();
}

export function ColorPicker({
  label,
  value,
  onChange,
  presets,
  recents = [],
  hint,
}: Props) {
  const id = useId();
  const [text, setText] = useState(value);

  // 부모가 value 를 갱신하면 text 도 같이 (다른 경로로 값 바뀔 때 대비)
  useEffect(() => {
    setText(value);
  }, [value]);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="text-[12.5px] font-semibold text-[var(--text-muted)]">
        {label}
        {hint ? (
          <span className="ml-1 text-[10.5px] font-medium text-[var(--text-soft)]">
            {hint}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-2.5">
        <span className="relative inline-block">
          <input
            id={id}
            type="color"
            value={value}
            onChange={(e) => {
              const n = e.target.value.toUpperCase();
              setText(n);
              onChange(n);
            }}
            className="h-[46px] w-[46px] cursor-pointer rounded-[10px] border border-black/10 p-0 [-webkit-appearance:none] [appearance:none] hover:shadow-[0_0_0_3px_rgba(37,99,235,0.18)] [&::-webkit-color-swatch-wrapper]:rounded-[9px] [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-[9px] [&::-webkit-color-swatch]:border-none [&::-moz-color-swatch]:rounded-[9px] [&::-moz-color-swatch]:border-none"
            aria-label={label}
          />
          <span className="pointer-events-none absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9.5px] text-[var(--text-soft)]">
            눌러서 자세히
          </span>
        </span>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            const n = normalize(text);
            if (n) {
              setText(n);
              onChange(n);
            } else {
              setText(value); // 잘못된 입력은 되돌림
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
          }}
          className="min-w-0 flex-1 rounded-lg border-[1.5px] border-[var(--border)] bg-white px-2.5 py-2 font-mono text-[13.5px] uppercase outline-none focus:border-[var(--primary)]"
          maxLength={7}
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <span className="mr-0.5 text-[10.5px] tracking-wide text-[var(--text-soft)]">
          빠른 선택
        </span>
        {presets.map((p) => {
          const np = normalize(p);
          const active = np && np === value.toUpperCase();
          return (
            <button
              key={p}
              type="button"
              onClick={() => {
                if (np) {
                  setText(np);
                  onChange(np);
                }
              }}
              className={
                active
                  ? "h-[18px] w-[18px] rounded-full border-[1.5px] border-black/10 shadow-[0_0_0_2px_#fff,0_0_0_4px_var(--primary)]"
                  : "h-[18px] w-[18px] rounded-full border-[1.5px] border-black/10 transition-transform hover:scale-110"
              }
              style={{ background: p }}
              aria-label={`${p} 로 설정`}
            />
          );
        })}
      </div>

      {recents.length > 0 ? (
        <div className="flex items-center gap-1 border-t border-dashed border-[var(--border)] pt-1.5">
          <span className="mr-1 text-[10.5px] text-[var(--text-soft)]">
            최근
          </span>
          {recents.map((r) => {
            const nr = normalize(r);
            return (
              <button
                key={r}
                type="button"
                onClick={() => {
                  if (nr) {
                    setText(nr);
                    onChange(nr);
                  }
                }}
                className="h-[14px] w-[14px] rounded-full border border-black/10 transition-transform hover:scale-[1.18]"
                style={{ background: r }}
                aria-label={`최근 사용 ${r}`}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
