"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import type { BrandKit } from "@/lib/custom-templates/types";

type Item = { id: string; name: string; brand: BrandKit; updatedAt: number };

export default function MyTemplatesPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    try {
      const res = await fetch("/api/my-templates", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { templates: Item[] };
      setItems(data.templates);
    } catch (e) {
      setError(e instanceof Error ? e.message : "목록을 불러오지 못했어요.");
    }
  };

  useEffect(() => {
    // mount 1회 fetch — cascade 위험 없음. 기존 페이지들도 같은 패턴.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  const create = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/my-templates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "새 양식" }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? `생성 실패 (${res.status})`);
      }
      const data = (await res.json()) as { template: Item };
      window.location.href = `/my-templates/${data.template.id}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : "양식을 만들지 못했어요.");
      setCreating(false);
    }
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`‘${name}’ 양식을 지울까요?`)) return;
    try {
      const res = await fetch(`/api/my-templates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`삭제 실패 (${res.status})`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "삭제에 실패했어요.");
    }
  };

  return (
    <>
      <TopNav />
      <main className="mx-auto w-full max-w-[1100px] px-6 py-10">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="m-0 mb-1.5 text-[28px] font-bold tracking-[-0.02em]">
              내 양식
            </h1>
            <p className="m-0 text-[14.5px] text-[var(--text-muted)]">
              회사 로고·색·폰트가 들어간 양식을 만들어 두면, 새 발표 자료
              만들 때 한 번에 적용돼요.
            </p>
          </div>
          <button
            type="button"
            onClick={create}
            disabled={creating}
            className="inline-flex items-center gap-2.5 rounded-[10px] bg-[var(--primary)] px-5 py-3 text-[14px] font-semibold text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)] disabled:opacity-40"
          >
            <span className="text-[16px]">+</span>{" "}
            {creating ? "준비 중…" : "새 양식 만들기"}
          </button>
        </div>

        {error ? (
          <div className="mb-4 rounded-lg border border-[rgba(239,68,68,0.25)] bg-[var(--danger-soft)] px-4 py-3 text-[13.5px] font-semibold text-[var(--danger)]">
            {error}
          </div>
        ) : null}

        {items === null ? (
          <div className="text-[14px] text-[var(--text-muted)]">
            불러오는 중…
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-2)] p-12 text-center">
            <div className="mb-2 text-[16px] font-semibold">
              아직 양식이 없어요
            </div>
            <div className="mb-4 text-[13.5px] text-[var(--text-muted)]">
              위 [+ 새 양식 만들기] 로 첫 양식을 만들어 보세요.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
            {items.map((t) => (
              <div
                key={t.id}
                className="flex flex-col overflow-hidden rounded-[14px] border-[1.5px] border-[var(--border)] bg-white transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="relative aspect-video bg-[var(--surface-2)]">
                  <iframe
                    title={t.name}
                    src={`/api/my-templates/${t.id}/preview?logoVer=${t.updatedAt}`}
                    sandbox=""
                    className="block h-full w-full border-0"
                  />
                </div>
                <div className="border-t border-[var(--border)] px-4 py-3.5">
                  <div className="text-[15px] font-bold tracking-[-0.01em]">
                    {t.name}
                  </div>
                  <div className="mt-1 text-[12.5px] text-[var(--text-muted)]">
                    {new Date(t.updatedAt).toLocaleDateString("ko-KR")}
                  </div>
                </div>
                <div className="flex gap-2 border-t border-[var(--border)] bg-[var(--surface-2)] px-4 py-2.5 text-[13px]">
                  <Link
                    href={`/my-templates/${t.id}`}
                    className="rounded px-2 py-1 text-[var(--text-muted)] no-underline hover:bg-white hover:text-[var(--text)] hover:no-underline"
                  >
                    ✎ 수정
                  </Link>
                  <button
                    type="button"
                    onClick={() => void remove(t.id, t.name)}
                    className="ml-auto rounded px-2 py-1 text-[var(--text-muted)] hover:bg-white hover:text-[var(--danger)]"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
