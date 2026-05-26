"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ColorPicker } from "./ColorPicker";
import { ArchetypePicker } from "./ArchetypePicker";
import { ScaledSlideFrame } from "./ScaledSlideFrame";
import type {
  AIArchetypeEntry,
  ArchetypeKey,
  BrandKit,
} from "@/lib/custom-templates/types";
import { ALLOWED_FONTS } from "@/lib/custom-templates/types";

type Props = {
  templateId: string;
  initialName: string;
  initialBrand: BrandKit;
};

const PRIMARY_PRESETS = [
  "#003C71",
  "#0F172A",
  "#7C3AED",
  "#DC2626",
  "#059669",
  "#EA580C",
];
const ACCENT_PRESETS = [
  "#FFB81C",
  "#FFC107",
  "#06B6D4",
  "#EC4899",
  "#84CC16",
  "#E5E7EB",
];

export function MyTemplateBuilder({
  templateId,
  initialName,
  initialBrand,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [brand, setBrand] = useState<BrandKit>(initialBrand);
  // 0 = 로고 없음, > 0 = cache buster (업로드 직후 Date.now() 로 갱신).
  const [logoVer, setLogoVer] = useState<number>(initialBrand.logoPath ? 1 : 0);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const logoPreviewUrl =
    logoVer > 0
      ? `/api/my-templates/${templateId}/logo/file?v=${logoVer}`
      : null;

  const archCover = brand.archetypes?.cover ?? "";
  const archBody = brand.archetypes?.body ?? "";

  const previewSrc =
    `/api/my-templates/${templateId}/preview` +
    `?primary=${encodeURIComponent(brand.primaryColor)}` +
    `&accent=${encodeURIComponent(brand.accentColor)}` +
    `&font=${encodeURIComponent(brand.fontFamily)}` +
    `&cover=${encodeURIComponent(archCover)}` +
    `&body=${encodeURIComponent(archBody)}` +
    `&logoVer=${logoVer || "none"}`;

  const save = async (redirect = false) => {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/my-templates/${templateId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, brand }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? `저장에 실패했어요. (${res.status})`);
      }
      if (redirect) router.push("/my-templates");
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했어요.");
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("logo", file);
      const res = await fetch(`/api/my-templates/${templateId}/logo`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          body?.error ?? `로고 업로드에 실패했어요. (${res.status})`,
        );
      }
      const data = (await res.json()) as { logoPath: string };
      setBrand({ ...brand, logoPath: data.logoPath });
      setLogoVer(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "로고 업로드에 실패했어요.");
    } finally {
      setUploading(false);
    }
  };

  const removeLogo = async () => {
    if (!brand.logoPath) return;
    if (!confirm("로고를 지울까요?")) return;
    setError(null);
    try {
      const res = await fetch(`/api/my-templates/${templateId}/logo`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`삭제 실패 (${res.status})`);
      setBrand({ ...brand, logoPath: null });
      setLogoVer(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "로고 삭제에 실패했어요.");
    }
  };

  return (
    <div className="mx-auto max-w-[1080px] px-6 py-8 pb-24">
      {/* 헤더 — 양식 이름 */}
      <div className="mb-5 flex items-center gap-3">
        <Link
          href="/my-templates"
          className="rounded-lg px-2.5 py-1.5 text-[13.5px] text-[var(--text-muted)] no-underline hover:bg-[var(--surface-2)] hover:no-underline"
        >
          ◀ 양식 목록
        </Link>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="양식 이름을 적어 주세요"
          className="flex-1 rounded-[10px] border-[1.5px] border-transparent bg-transparent px-3.5 py-2 text-[22px] font-bold tracking-[-0.015em] outline-none hover:border-[var(--border)] focus:border-[var(--primary)] focus:bg-white"
          maxLength={80}
        />
      </div>

      {/* 1. 브랜드 섹션 */}
      <section className="mb-4 rounded-2xl border-[1.5px] border-[var(--border)] bg-white p-6">
        <h2 className="m-0 mb-1 flex items-center gap-2 text-[16px] font-bold tracking-[-0.01em]">
          <span className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[var(--primary)] text-[11px] font-bold text-[var(--primary-foreground)]">
            1
          </span>
          회사 브랜드
        </h2>
        <p className="mb-5 pl-[30px] text-[13px] text-[var(--text-muted)]">
          로고·색·폰트를 정해 두면 새 발표 자료가 이 양식대로 만들어져요.
        </p>

        <div className="grid grid-cols-[1fr_1fr_1fr_1.2fr] gap-3.5">
          {/* 로고 */}
          <div className="flex flex-col gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3.5">
            <div className="flex items-center justify-between">
              <div className="text-[12.5px] font-semibold text-[var(--text-muted)]">
                로고
              </div>
              {brand.logoPath ? (
                <button
                  type="button"
                  onClick={removeLogo}
                  className="text-[11px] text-[var(--text-soft)] hover:text-[var(--danger)]"
                >
                  지우기
                </button>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex min-h-[64px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border-[1.5px] border-dashed border-[var(--border-strong)] bg-white p-2 text-[13px] text-[var(--text-muted)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:opacity-50"
            >
              {uploading ? (
                "업로드 중…"
              ) : logoPreviewUrl ? (
                <span className="flex items-center gap-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logoPreviewUrl}
                    alt="로고 미리보기"
                    className="h-[38px] w-[38px] rounded object-contain"
                  />
                  <span className="text-[12.5px] font-medium text-[var(--text)]">
                    바꾸기
                  </span>
                </span>
              ) : (
                <span>📷 로고 올리기</span>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.svg,.webp"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadLogo(f);
                e.target.value = "";
              }}
            />
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3.5">
            <ColorPicker
              label="주 색상 (제목·강조)"
              value={brand.primaryColor}
              onChange={(c) => setBrand({ ...brand, primaryColor: c })}
              presets={PRIMARY_PRESETS}
            />
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3.5">
            <ColorPicker
              label="강조 색상 (포인트)"
              value={brand.accentColor}
              onChange={(c) => setBrand({ ...brand, accentColor: c })}
              presets={ACCENT_PRESETS}
            />
          </div>

          {/* 폰트 */}
          <div className="flex flex-col gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3.5">
            <div className="text-[12.5px] font-semibold text-[var(--text-muted)]">
              글꼴
            </div>
            <select
              value={brand.fontFamily}
              onChange={(e) =>
                setBrand({ ...brand, fontFamily: e.target.value })
              }
              className="rounded-lg border-[1.5px] border-[var(--border)] bg-white px-3 py-2.5 text-[14px] outline-none focus:border-[var(--primary)]"
            >
              {ALLOWED_FONTS.map((f) => (
                <option key={f} value={f}>
                  {f}
                  {f === "Pretendard" ? " (기본 추천)" : ""}
                </option>
              ))}
            </select>
            <div
              className="rounded-md border border-[var(--border)] bg-white px-2.5 py-1.5 text-[13px] font-bold text-[var(--text-muted)]"
              style={{ fontFamily: brand.fontFamily }}
            >
              가나다라 ABC 123
            </div>
          </div>
        </div>

        {/* 라이브 미리보기 — sample slide 가 이 brand 로 즉시 렌더 */}
        <div className="mt-5 aspect-video w-full overflow-hidden rounded-[12px] border border-[var(--border)] bg-white shadow-sm">
          <ScaledSlideFrame title="미리보기" src={previewSrc} />
        </div>
      </section>

      {/* 2. 슬라이드 종류 섹션 — v2 minimal: 표지·본문 2 종 */}
      <section className="mb-4 rounded-2xl border-[1.5px] border-[var(--border)] bg-white p-6">
        <h2 className="m-0 mb-1 flex items-center gap-2 text-[16px] font-bold tracking-[-0.01em]">
          <span className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[var(--primary)] text-[11px] font-bold text-[var(--primary-foreground)]">
            2
          </span>
          슬라이드 종류별 모양
        </h2>
        <p className="mb-5 pl-[30px] text-[13px] text-[var(--text-muted)]">
          각 종류마다 마음에 드는 모양을 하나 골라 두면, 그 양식대로 슬라이드가
          만들어져요. 안 고른 종류는 AI 가 알아서 비슷한 모양으로 채워요.
          <span className="ml-1 text-[var(--text-soft)]">
            (지금은 표지·본문 2 종부터 — 나머지 5 종은 다음 업데이트)
          </span>
        </p>
        <ArchetypePicker
          templateId={templateId}
          brand={brand}
          archetypes={brand.archetypes ?? {}}
          onChange={(arch) => setBrand({ ...brand, archetypes: arch })}
          onAIGenerated={(entries: AIArchetypeEntry[]) => {
            // 서버가 이미 brand_json 에 저장했음. 로컬 state 도 동기화해
            // 갤러리에 즉시 표시.
            const cur = brand.aiArchetypes ?? {};
            const next = { ...cur };
            for (const e of entries) {
              const list = [...(next[e.archKey] ?? []), e];
              next[e.archKey] = list;
            }
            setBrand({ ...brand, aiArchetypes: next });
          }}
          onAIDeleted={(archKey: ArchetypeKey, entryId: string) => {
            // 서버 DELETE 끝난 후 호출됨. 로컬 state 도 제거.
            const cur = brand.aiArchetypes ?? {};
            const next = { ...cur };
            next[archKey] = (next[archKey] ?? []).filter(
              (e) => e.id !== entryId,
            );
            // 만약 그 옵션이 현재 archetype pick 이었으면 해제.
            const nextArch = { ...(brand.archetypes ?? {}) };
            if (nextArch[archKey] === entryId) nextArch[archKey] = null;
            setBrand({ ...brand, aiArchetypes: next, archetypes: nextArch });
          }}
        />
      </section>

      {/* 에러 */}
      {error ? (
        <div className="mb-3 rounded-lg border border-[rgba(239,68,68,0.25)] bg-[var(--danger-soft)] px-4 py-3 text-[13.5px] font-semibold text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      {/* sticky 액션 */}
      <div
        className="fixed bottom-0 left-0 right-0 z-30 flex items-center gap-3.5 border-t border-[var(--border)] px-6 py-3.5"
        style={{
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "saturate(180%) blur(14px)",
          WebkitBackdropFilter: "saturate(180%) blur(14px)",
        }}
      >
        <Link
          href="/my-templates"
          className="rounded-[10px] border border-[var(--border)] bg-transparent px-4 py-2.5 text-[14px] font-semibold text-[var(--text)] no-underline hover:bg-[var(--surface-2)] hover:no-underline"
        >
          취소
        </Link>
        <div className="flex-1 text-[13px] text-[var(--text-muted)]">
          {saving
            ? "저장 중…"
            : "변경한 내용은 [저장] 누를 때 반영돼요."}
        </div>
        <button
          type="button"
          onClick={() => save(false)}
          disabled={saving || uploading}
          className="rounded-[10px] border border-[var(--border)] bg-transparent px-4 py-2.5 text-[14px] font-semibold hover:bg-[var(--surface-2)] disabled:opacity-40"
        >
          저장
        </button>
        <button
          type="button"
          onClick={() => save(true)}
          disabled={saving || uploading || !name.trim()}
          className="rounded-[10px] border border-[var(--primary)] bg-[var(--primary)] px-5 py-3 text-[14.5px] font-semibold text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)] disabled:opacity-40"
        >
          저장하고 끝내기 →
        </button>
      </div>
    </div>
  );
}
