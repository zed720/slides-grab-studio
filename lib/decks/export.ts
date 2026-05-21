import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";
import { getDeck } from "@/lib/db/queries/decks";
import { isBulkEditing } from "@/lib/decks/bulk-edit";
import { cleanupDeckSlideArtifacts } from "@/lib/decks/cleanup-html";
import { deckDir, ensureDir } from "@/lib/storage";

// 내보내기 — slides-grab CLI 를 직접 호출해서 deck 을 PDF/PNG/PPTX/Figma 로
// 변환한다. AI 호출 X (순수 변환). job 상태는 in-memory.
//
// 디스크: data/decks/<id>/exports/<jobId>.{pdf,zip,pptx}
//   pdf:   slides-grab pdf   → <jobId>.pdf
//   png:   slides-grab png   → <jobId>-png/  →  zip 묶기  → <jobId>.zip
//   pptx:  slides-grab convert → <jobId>.pptx
//   figma: slides-grab figma → <jobId>.pptx  (사용자 표시 파일명은 *-figma.pptx)

export type ExportFormat = "pdf" | "png" | "pptx" | "figma";

export const VALID_FORMATS: readonly ExportFormat[] = [
  "pdf",
  "png",
  "pptx",
  "figma",
] as const;

// upstream 이슈로 일시 비활성화된 형식 (UI 에서도 잠금 표시).
// slides-grab 1.2.6/1.3.0 의 npm 배포본에 `scripts/html2png.js` 가 빠져 있어
// `png` 명령 실행 시 module-not-found. upstream fix 되면 Set 에서 빼면 다시 활성.
const DISABLED_FORMATS = new Set<ExportFormat>(["png"]);

export type ExportJobStatus = "running" | "done" | "failed";

export type ExportJob = {
  id: string;
  deckId: string;
  format: ExportFormat;
  status: ExportJobStatus;
  filename: string; // 사용자 다운로드 표시명 (한글 OK)
  filePath?: string; // 디스크 절대 경로
  sizeBytes?: number;
  error?: string;
  startedAt: number;
  completedAt?: number;
};

const jobs = new Map<string, ExportJob>();
const runningByDeck = new Map<string, string>(); // deckId → 현재 running jobId
const TIMEOUT_MS = 10 * 60 * 1000;

export function isExporting(deckId: string): boolean {
  return runningByDeck.has(deckId);
}

export function startExport(
  deckId: string,
  format: ExportFormat,
): { jobId?: string; error?: string } {
  const deck = getDeck(deckId);
  if (!deck) return { error: "발표 자료를 찾지 못했어요." };
  if (DISABLED_FORMATS.has(format)) {
    return { error: "이 형식은 지금 잠시 사용할 수 없어요. 다른 형식을 골라 주세요." };
  }
  if (deck.status !== "ready") {
    return { error: "슬라이드가 완성된 후에만 내보낼 수 있어요." };
  }
  if (isBulkEditing(deckId)) {
    return { error: "지금 전체 수정이 진행 중이에요. 끝난 뒤 다시 시도해 주세요." };
  }
  if (runningByDeck.has(deckId)) {
    return { error: "지금 다른 형식의 파일을 만들고 있어요. 끝난 뒤 다시 시도해 주세요." };
  }

  const jobId = randomUUID();
  const job: ExportJob = {
    id: jobId,
    deckId,
    format,
    status: "running",
    filename: userFilename(deck.title, format),
    startedAt: Date.now(),
  };
  jobs.set(jobId, job);
  runningByDeck.set(deckId, jobId);

  void runExport(jobId)
    .catch((err) => {
      console.error("[export] failed", jobId, err);
      const j = jobs.get(jobId);
      if (j) {
        const raw = err instanceof Error ? err.message : String(err);
        j.status = "failed";
        j.error = friendlyExportError(j.format, raw);
        j.completedAt = Date.now();
      }
    })
    .finally(() => {
      runningByDeck.delete(deckId);
    });

  return { jobId };
}

export function getJob(deckId: string, jobId: string): ExportJob | null {
  const j = jobs.get(jobId);
  if (j && j.deckId === deckId) return j;

  // 서버 재시작 등으로 in-memory 가 비었을 때 디스크 복원.
  // 어떤 ext 인지 추측 — pptx 의 경우 일반/figma 구분은 못 함 (다운로드는 됨).
  const exportsDir = path.join(deckDir(deckId), "exports");
  if (!fssync.existsSync(exportsDir)) return null;

  for (const ext of ["pdf", "zip", "pptx"] as const) {
    const filePath = path.join(exportsDir, `${jobId}.${ext}`);
    if (!fssync.existsSync(filePath)) continue;
    try {
      const stat = fssync.statSync(filePath);
      const format: ExportFormat =
        ext === "pdf" ? "pdf" : ext === "zip" ? "png" : "pptx";
      const deck = getDeck(deckId);
      return {
        id: jobId,
        deckId,
        format,
        status: "done",
        filename: userFilename(deck?.title ?? "slides", format),
        filePath,
        sizeBytes: stat.size,
        startedAt: stat.mtimeMs,
        completedAt: stat.mtimeMs,
      };
    } catch {}
  }
  return null;
}

async function runExport(jobId: string): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) throw new Error("Job missing");

  const wd = deckDir(job.deckId);
  ensureDir(wd);
  const exportsDir = path.join(wd, "exports");
  ensureDir(exportsDir);

  // editor selection overlay 가 slide HTML 에 박혀 있으면 PDF/PPTX 에도 그대로
  // 들어가서 사고. 부팅 cleanup 이 일반적으로 처리하지만 같은 세션 안 수정 →
  // export 의 짧은 윈도우를 막기 위해 한 번 더.
  await cleanupDeckSlideArtifacts(job.deckId);

  const projectBin = path.resolve(process.cwd(), "node_modules", ".bin");
  const env = {
    ...process.env,
    PATH: `${projectBin}:${process.env.PATH ?? ""}`,
  };

  // slides-grab CLI 인자 — cwd 기준 상대 경로
  const slidesDir = "output";
  const outBase = `exports/${jobId}`;

  let cmd: string;
  let args: string[];
  let expectedFile: string; // 디스크 절대 경로 (검증용)
  let postProcess: (() => Promise<string>) | null = null;

  switch (job.format) {
    case "pdf":
      cmd = "slides-grab";
      args = ["pdf", "--slides-dir", slidesDir, "--output", `${outBase}.pdf`];
      expectedFile = path.join(exportsDir, `${jobId}.pdf`);
      break;
    case "png":
      cmd = "slides-grab";
      args = [
        "png",
        "--slides-dir",
        slidesDir,
        "--output-dir",
        `${outBase}-png`,
      ];
      expectedFile = path.join(exportsDir, `${jobId}.zip`);
      postProcess = async () => {
        const pngDir = path.join(exportsDir, `${jobId}-png`);
        const zipPath = path.join(exportsDir, `${jobId}.zip`);
        await runZip(pngDir, zipPath);
        // 정리 — 묶인 후 PNG 폴더 제거
        await fs.rm(pngDir, { recursive: true, force: true });
        return zipPath;
      };
      break;
    case "pptx":
      cmd = "slides-grab";
      args = [
        "convert",
        "--slides-dir",
        slidesDir,
        "--output",
        `${outBase}.pptx`,
      ];
      expectedFile = path.join(exportsDir, `${jobId}.pptx`);
      break;
    case "figma":
      cmd = "slides-grab";
      args = [
        "figma",
        "--slides-dir",
        slidesDir,
        "--output",
        `${outBase}.pptx`,
      ];
      expectedFile = path.join(exportsDir, `${jobId}.pptx`);
      break;
  }

  console.log(
    `[export] ${jobId} (${job.format}): spawn ${cmd} ${args.join(" ")} (cwd=${wd})`,
  );

  await runProcess({ cmd, args, cwd: wd, env, timeoutMs: TIMEOUT_MS });

  if (postProcess) {
    expectedFile = await postProcess();
  }

  // 파일 검증 — slides-grab 이 0 으로 끝났어도 파일이 없으면 실패 처리
  const stat = await fs.stat(expectedFile);
  job.filePath = expectedFile;
  job.sizeBytes = stat.size;
  job.status = "done";
  job.completedAt = Date.now();
  console.log(
    `[export] ${jobId} (${job.format}): done · ${stat.size} bytes · ${expectedFile}`,
  );
}

function runProcess({
  cmd,
  args,
  cwd,
  env,
  timeoutMs,
}: {
  cmd: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    });

    let stderr = "";
    let stdoutTail = "";
    child.stdout?.on("data", (c: Buffer) => {
      stdoutTail = (stdoutTail + c.toString("utf-8")).slice(-2000);
    });
    child.stderr?.on("data", (c: Buffer) => {
      stderr = (stderr + c.toString("utf-8")).slice(-4000);
    });

    const timer = setTimeout(() => {
      try {
        if (child.pid) process.kill(-child.pid, "SIGKILL");
      } catch {}
      reject(new Error(`내보내기 타임아웃 (${timeoutMs / 60000}분 초과)`));
    }, timeoutMs);

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
      } else {
        const tail = stderr || stdoutTail;
        console.error(
          `[export] subprocess exited with code ${code ?? "?"}\n${tail}`,
        );
        reject(
          new Error(
            `내보내기에 실패했어요. ${tail.slice(0, 600) || "(자세한 사유 없음)"}`,
          ),
        );
      }
    });
  });
}

function runZip(srcDir: string, outZip: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // -j: 경로 없이 파일만 (zip 안에 PNG 들 평탄하게)
    // -r: 재귀 (사실 -j 와 함께면 폴더 한 단계만 충분)
    const child = spawn("zip", ["-j", "-r", outZip, srcDir], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr?.on("data", (c: Buffer) => {
      stderr = (stderr + c.toString("utf-8")).slice(-2000);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else {
        console.error(`[export] zip exited with code ${code ?? "?"}\n${stderr}`);
        reject(
          new Error(
            `이미지를 묶는 중 문제가 생겼어요. ${
              stderr.slice(0, 400) || "(자세한 사유 없음)"
            }`,
          ),
        );
      }
    });
  });
}

function userFilename(deckTitle: string, format: ExportFormat): string {
  const base = safeFilename(deckTitle);
  switch (format) {
    case "pdf":
      return `${base}.pdf`;
    case "png":
      return `${base}.zip`;
    case "pptx":
      return `${base}.pptx`;
    case "figma":
      return `${base}-figma.pptx`;
  }
}

function safeFilename(title: string): string {
  // OS 금지 문자 + control 문자 제거. 공백은 하이픈. 한국어/숫자/하이픈 유지.
  const cleaned = (title ?? "")
    .trim()
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "slides";
}

// slides-grab CLI 의 stderr 메시지가 비개발자에게 의미 없는 경우 친절 한국어로
// 변환. 명확히 확인된 패턴만 매핑하고 나머지는 raw 유지 (사용자 진단에 도움).
function friendlyExportError(format: ExportFormat, raw: string): string {
  if (
    format === "figma" &&
    /Background images on DIV elements/i.test(raw)
  ) {
    return "이 디자인은 Figma Slides 로 변환할 수 없는 요소를 포함하고 있어요 (배경 이미지). 발표용으로는 PDF 를, 편집이 필요하면 PPTX 를 받아 주세요.";
  }
  return raw;
}

export function mimeForFormat(format: ExportFormat): string {
  switch (format) {
    case "pdf":
      return "application/pdf";
    case "png":
      return "application/zip";
    case "pptx":
    case "figma":
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }
}
