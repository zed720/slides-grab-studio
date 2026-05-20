import Link from "next/link";

export type Step = 1 | 2 | 3 | 4 | 5;

const steps: { n: Step; label: string }[] = [
  { n: 1, label: "AI 연결" },
  { n: 2, label: "내용 올리기" },
  { n: 3, label: "디자인 고르기" },
  { n: 4, label: "발표 구조 보기" },
  { n: 5, label: "슬라이드 보기" },
];

export function TopNav({ active }: { active?: Step }) {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-white/85 backdrop-blur-md backdrop-saturate-150">
      <div className="mx-auto flex max-w-[1200px] items-center gap-4 px-6 py-3.5">
        <Link
          href="/"
          className="flex items-center gap-2 text-[14px] font-semibold tracking-tight text-inherit no-underline hover:no-underline"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/bitree-icon.png"
            alt="Bitree"
            className="h-6 w-6"
          />
          <span>bitree slide studio</span>
        </Link>
        {active ? (
          <div className="flex flex-1 items-center gap-1.5 text-[13px] text-[var(--text-muted)]">
            {steps.map((s, i) => (
              <span key={s.n} className="flex items-center gap-1.5">
                <span
                  className={
                    s.n === active
                      ? "inline-flex items-center gap-1.5 rounded-full border border-[var(--primary)] bg-[var(--primary)] px-2.5 py-1 font-semibold text-[var(--primary-foreground)]"
                      : "inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1"
                  }
                >
                  {s.n} · {s.label}
                </span>
                {i < steps.length - 1 ? (
                  <span className="text-[11px] text-[var(--text-soft)]">›</span>
                ) : null}
              </span>
            ))}
          </div>
        ) : (
          <div className="flex-1" />
        )}
      </div>
    </header>
  );
}
