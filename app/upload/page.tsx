"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { TopNav } from "@/components/TopNav";

const SLIDE_COUNT_OPTIONS = [
  "5장 안팎",
  "10장 안팎",
  "15장 안팎",
  "20장 이상",
  "AI가 알아서",
];
const TONE_OPTIONS = ["진지하게", "친근하게", "트렌디하게", "격식있게"];

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_TOTAL_BYTES = 200 * 1024 * 1024;
const ALLOWED_EXTS = [".md", ".txt", ".pdf", ".docx", ".pptx"];

function fileExt(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx).toLowerCase() : "";
}
function formatMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export default function UploadPage() {
  return (
    <Suspense fallback={<UploadShell><div /></UploadShell>}>
      <UploadInner />
    </Suspense>
  );
}

function UploadShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNav active={2} />
      <main className="mx-auto max-w-[920px] px-6 pt-14 pb-20">{children}</main>
    </>
  );
}

function UploadInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const providerId = searchParams.get("provider") ?? "";
  const sample = searchParams.get("sample") ?? "";

  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<"text" | "file">("text");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [slideCount, setSlideCount] = useState("");
  const [tone, setTone] = useState("진지하게");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [samplePrefilled, setSamplePrefilled] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // sample query 로 진입한 경우 — 환영 화면의 "샘플 빠른 시작" 흐름.
  // mount 시 한 번만 fetch 후 폼 자동 채움. 사용자는 그대로 다음으로 가도 되고
  // 본문을 자유롭게 수정해도 OK.
  useEffect(() => {
    if (!sample) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/samples/${encodeURIComponent(sample)}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { title?: string; content?: string };
        if (cancelled) return;
        if (data.title) setTitle(data.title);
        if (data.content) setText(data.content);
        setSamplePrefilled(true);
      } catch {
        // 실패해도 빈 폼으로 그대로 진행
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sample]);

  const addFiles = (incoming: FileList | File[]) => {
    const list = Array.from(incoming);
    const accepted: File[] = [];
    const rejected: string[] = [];
    for (const f of list) {
      const ext = fileExt(f.name);
      if (!ALLOWED_EXTS.includes(ext)) {
        rejected.push(`${f.name} — 지원하지 않는 형식`);
        continue;
      }
      if (f.size > MAX_FILE_BYTES) {
        rejected.push(
          `${f.name} — 너무 커요 (${formatMb(f.size)}, 최대 ${formatMb(MAX_FILE_BYTES)})`,
        );
        continue;
      }
      accepted.push(f);
    }
    setFiles((prev) => {
      const next = [...prev, ...accepted];
      const total = next.reduce((s, f) => s + f.size, 0);
      if (total > MAX_TOTAL_BYTES) {
        rejected.push(
          `합쳐 ${formatMb(total)} — 모두 합쳐 ${formatMb(MAX_TOTAL_BYTES)} 까지만 가능해요`,
        );
        return prev;
      }
      return next;
    });
    setError(rejected.length > 0 ? rejected.join(" · ") : null);
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const onSubmit = async () => {
    setError(null);
    if (!title.trim()) {
      setError("발표 제목을 입력해 주세요.");
      return;
    }
    if (mode === "text" && !text.trim() && files.length === 0) {
      setError("내용을 텍스트로 적거나 파일을 한 개 이상 올려주세요.");
      return;
    }
    if (mode === "file" && files.length === 0 && !text.trim()) {
      setError("파일을 한 개 이상 올려주세요.");
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.set("title", title.trim());
      fd.set("text", text);
      fd.set("slideCount", slideCount);
      fd.set("tone", tone);
      if (providerId) fd.set("providerId", providerId);
      for (const f of files) fd.append("files", f);

      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(data?.error ?? `요청이 실패했어요 (HTTP ${res.status})`);
      }
      const data = (await res.json()) as { deckId: string };

      const next = new URLSearchParams();
      next.set("deck", data.deckId);
      if (providerId) next.set("provider", providerId);
      router.push(`/templates?${next.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 중 문제가 생겼어요.");
      setSubmitting(false);
    }
  };

  return (
    <UploadShell>
      <div>
        <h1 className="m-0 mb-2.5 text-[32px] font-bold leading-tight tracking-[-0.02em]">
          어떤 내용으로 발표를 만들까요?
        </h1>
        <p className="m-0 mb-9 text-[16px] text-[var(--text-muted)]">
          제목과 발표에 담길 내용만 알려주시면, 나머지는 AI 가 정리해서 슬라이드를 만들어요.
        </p>
      </div>

      {samplePrefilled ? (
        <div className="mb-5 flex items-center gap-2.5 rounded-[10px] border border-[#dbeafe] bg-[var(--accent-soft)] px-4 py-3 text-[13px]">
          <span>📄</span>
          <span>
            <b className="font-bold">샘플로 시작했어요.</b> 그대로 다음 단계로 가셔도 되고, 본문을 자유롭게 수정하셔도 돼요.
          </span>
        </div>
      ) : null}

      <div className="rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-7 shadow-[var(--shadow-sm)]">
        {/* 제목 */}
        <div className="mb-5">
          <label
            htmlFor="title"
            className="mb-2 block text-[14px] font-semibold tracking-[-0.005em]"
          >
            발표 제목 <span className="text-[var(--danger)]">*</span>
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 2026년 상반기 사업 계획"
            className="w-full rounded-[10px] border-[1.5px] border-[var(--border)] bg-[var(--surface)] px-3.5 py-3 text-[15px] outline-none transition-colors focus:border-[var(--primary)]"
          />
          <span className="mt-2 block text-[12.5px] text-[var(--text-muted)]">
            완성된 슬라이드의 첫 페이지에 들어가요.
          </span>
        </div>

        {/* 내용 올리기 — 탭 */}
        <div className="mb-5">
          <label className="mb-2 block text-[14px] font-semibold tracking-[-0.005em]">
            내용 올리기 <span className="text-[var(--danger)]">*</span>
          </label>
          <div className="mb-4 inline-flex gap-0.5 rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] p-1">
            <TabButton
              active={mode === "text"}
              onClick={() => setMode("text")}
              label="텍스트로 붙여넣기"
            />
            <TabButton
              active={mode === "file"}
              onClick={() => setMode("file")}
              label="파일로 올리기"
            />
          </div>

          {mode === "text" ? (
            <div>
              <textarea
                rows={8}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="발표에 담길 내용을 자유롭게 적어주세요. 메모나 문서를 그대로 붙여넣어도 좋아요. 길이에 상관없이 AI 가 알아서 정리합니다."
                className="w-full resize-y rounded-[10px] border-[1.5px] border-[var(--border)] bg-[var(--surface)] px-3.5 py-3 text-[15px] outline-none transition-colors focus:border-[var(--primary)]"
              />
              <span className="mt-2 block text-[12.5px] text-[var(--text-muted)]">
                예시: 회의록, 보고서 초안, 핵심 메시지 메모 등
              </span>
            </div>
          ) : (
            <Dropzone
              files={files}
              onAdd={addFiles}
              onRemove={removeFile}
              inputRef={fileInputRef}
            />
          )}
        </div>

        {/* 슬라이드 분량 */}
        <div className="mb-5">
          <label className="mb-2 block text-[14px] font-semibold tracking-[-0.005em]">
            몇 장 정도로 만들까요?
            {slideCount ? (
              <span className="ml-2 text-[12.5px] font-normal text-[var(--accent)]">
                · 선택: <b>{slideCount}</b>
              </span>
            ) : (
              <span className="ml-2 text-[12.5px] font-normal text-[var(--text-soft)]">
                · 안 고르면 AI 가 알아서
              </span>
            )}
          </label>
          <ChipRow
            options={SLIDE_COUNT_OPTIONS}
            value={slideCount}
            onChange={setSlideCount}
          />
        </div>

        {/* 분위기 */}
        <div className="mb-0">
          <label className="mb-2 block text-[14px] font-semibold tracking-[-0.005em]">
            분위기는 어떻게?{" "}
            <span className="text-[var(--text-muted)] font-normal">(선택)</span>
          </label>
          <ChipRow options={TONE_OPTIONS} value={tone} onChange={setTone} />
        </div>
      </div>

      {error ? (
        <div className="mt-4 flex items-center gap-2 rounded-[10px] border border-[rgba(239,68,68,0.25)] bg-[var(--danger-soft)] px-4 py-3 text-[13.5px] font-semibold text-[var(--danger)]">
          <span>!</span>
          <span>{error}</span>
        </div>
      ) : null}

      <div className="mt-8 flex items-center justify-end gap-3">
        <Link
          href={providerId ? `/start?provider=${providerId}` : "/start"}
          className="mr-auto inline-flex items-center gap-2 rounded-[10px] border border-[var(--border)] bg-transparent px-5 py-3 text-[15px] font-semibold text-[var(--text)] no-underline transition-colors hover:bg-[var(--surface-2)] hover:no-underline"
        >
          ← 이전
        </Link>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-[12px] border border-[var(--primary)] bg-[var(--primary)] px-7 py-4 text-[16px] font-semibold text-[var(--primary-foreground)] transition-colors hover:bg-[var(--primary-hover)] disabled:opacity-50"
        >
          {submitting ? "저장 중…" : "디자인 고르러 가기 →"}
        </button>
      </div>
    </UploadShell>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-[8px] bg-[var(--surface)] px-4 py-2 text-[13.5px] font-semibold text-[var(--text)] shadow-[var(--shadow-sm)]"
          : "rounded-[8px] px-4 py-2 text-[13.5px] font-medium text-[var(--text-muted)]"
      }
    >
      {label}
    </button>
  );
}

function ChipRow({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={
            value === o
              ? "rounded-full border-[1.5px] border-[var(--primary)] bg-[var(--primary)] px-3.5 py-2 text-[13.5px] font-semibold text-[var(--primary-foreground)] select-none"
              : "rounded-full border-[1.5px] border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-[13.5px] text-[var(--text)] select-none hover:border-[var(--border-strong)]"
          }
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function Dropzone({
  files,
  onAdd,
  onRemove,
  inputRef,
}: {
  files: File[];
  onAdd: (f: FileList | File[]) => void;
  onRemove: (idx: number) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div>
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          setHover(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setHover(true);
        }}
        onDragLeave={() => setHover(false)}
        onDrop={(e) => {
          e.preventDefault();
          setHover(false);
          if (e.dataTransfer.files?.length) onAdd(e.dataTransfer.files);
        }}
        className={
          hover
            ? "flex flex-col items-center gap-3.5 rounded-[16px] border-2 border-dashed border-[var(--accent)] bg-[var(--accent-soft)] p-9 text-center transition-colors"
            : "flex flex-col items-center gap-3.5 rounded-[16px] border-2 border-dashed border-[var(--border-strong)] bg-[var(--surface-2)] p-9 text-center transition-colors"
        }
      >
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[28px]">
          ⬆
        </div>
        <div className="text-[15px] font-semibold">
          파일을 여기에 끌어다 놓으세요
        </div>
        <div className="text-[13px] text-[var(--text-muted)]">
          .txt · .md · .pdf · .docx · .pptx · 한 파일 50MB 이하
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) onAdd(e.target.files);
            e.target.value = "";
          }}
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[13.5px] font-semibold hover:bg-[var(--surface-2)]"
          >
            파일 고르기
          </button>
        </div>
      </div>

      {files.length > 0 ? (
        <div className="mt-3 flex flex-col gap-2">
          {files.map((f, i) => (
            <FileRow
              key={`${f.name}-${i}`}
              file={f}
              onRemove={() => onRemove(i)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FileRow({ file, onRemove }: { file: File; onRemove: () => void }) {
  const ext = file.name.split(".").pop()?.toUpperCase() ?? "FILE";
  return (
    <div className="flex items-center gap-2.5 rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2.5 text-[13.5px]">
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[10.5px] font-bold text-[var(--accent)]">
        {ext.slice(0, 4)}
      </span>
      <span className="flex-1 truncate font-medium">{file.name}</span>
      <span className="text-[12px] text-[var(--text-muted)]">
        {formatSize(file.size)}
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="cursor-pointer p-1 text-[var(--text-muted)] hover:text-[var(--text)]"
        aria-label="지우기"
      >
        ✕
      </button>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
