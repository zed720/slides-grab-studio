import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";
import { getDeck, updateDeck } from "@/lib/db/queries/decks";
import { isExporting } from "@/lib/decks/export";
import { buildClaudeArgs } from "@/lib/providers/claude-args";
import { deckDir, deckOutputDir, ensureDir } from "@/lib/storage";

// "전체 슬라이드 일괄 수정" — 사용자 자연어 지시로 deck 의 모든 슬라이드를
// 한 호출 안에 수정. AI 가 output/ 의 slide-NN.html 파일들을 직접 편집.
//
// 기존 generator 와 동일 패턴: claude -p spawn, cwd=deck dir, non-interactive
// 자동 승인. 다만 새 슬라이드 추가/삭제는 안 하고 기존 파일 수정만.

const bulkEditing = new Set<string>();
const TIMEOUT_MS = 20 * 60 * 1000;

export function isBulkEditing(deckId: string): boolean {
  return bulkEditing.has(deckId);
}

export function startBulkEdit(
  deckId: string,
  instruction: string,
): { started: boolean; reason?: string } {
  const deck = getDeck(deckId);
  if (!deck) throw new Error("Deck not found");
  if (bulkEditing.has(deckId)) {
    return {
      started: false,
      reason: "전체 수정이 이미 진행 중이에요. 끝난 뒤 다시 시도해 주세요.",
    };
  }
  if (deck.status !== "ready") {
    return { started: false, reason: "슬라이드가 완성된 상태에서만 가능해요." };
  }
  if (isExporting(deckId)) {
    return {
      started: false,
      reason: "지금 내보내기 파일을 만들고 있어요. 끝난 뒤 다시 시도해 주세요.",
    };
  }

  const trimmed = instruction.trim();
  if (!trimmed) {
    throw new Error("어떻게 고칠지 한 줄 적어 주세요.");
  }

  bulkEditing.add(deckId);
  updateDeck(deckId, { status: "generating" });

  void runBulkEdit(deckId, trimmed)
    .catch((err) => {
      console.error("[bulk-edit] failed", deckId, err);
      try {
        updateDeck(deckId, { status: "failed" });
      } catch {}
    })
    .finally(() => {
      bulkEditing.delete(deckId);
    });

  return { started: true };
}

async function runBulkEdit(deckId: string, instruction: string): Promise<void> {
  const deck = getDeck(deckId);
  if (!deck) throw new Error("Deck not found");

  const wd = deckDir(deckId);
  ensureDir(wd);
  const outDir = deckOutputDir(deckId);
  ensureDir(outDir);

  const provider = deck.provider_id ?? "claude-code";
  const prompt = buildBulkEditPrompt(instruction, provider);

  const projectBin = path.resolve(process.cwd(), "node_modules", ".bin");
  const env = {
    ...process.env,
    PATH: `${projectBin}:${process.env.PATH ?? ""}`,
  };

  let cmd: string;
  let args: string[];
  if (provider === "codex") {
    cmd = "codex";
    args = [
      "exec",
      "--sandbox",
      "workspace-write",
      "--skip-git-repo-check",
      prompt,
    ];
  } else {
    cmd = "claude";
    args = buildClaudeArgs(prompt);
  }

  console.log(`[bulk-edit] ${deckId}: spawn ${cmd} (cwd=${wd})`);

  // AI 시작 전 슬라이드 파일 mtime snapshot — 끝난 후 변경 있는지 비교
  const beforeSnapshot = await snapshotSlideMtimes(outDir);

  let aiError: unknown = null;
  try {
    await runProvider({ cmd, args, cwd: wd, env });
  } catch (err) {
    aiError = err;
    console.error(`[bulk-edit] ${deckId}: AI exit error`, err);
  }

  const afterSnapshot = await snapshotSlideMtimes(outDir);
  const anyChange = hasChange(beforeSnapshot, afterSnapshot);

  if (anyChange) {
    // 일부라도 슬라이드 수정됐으면 성공으로 간주 (AI 의 마지막 cleanup
    // 단계가 nonzero exit 으로 끝나도 결과물이 있으면 사용자에겐 성공).
    updateDeck(deckId, { status: "ready" });
    if (aiError) {
      console.warn(
        `[bulk-edit] ${deckId}: AI 가 nonzero exit 으로 끝났지만 디스크 변경 있어서 ready 로 처리`,
      );
    }
  } else if (aiError) {
    // 시작도 못 했거나 아무 변경 없음 — 진짜 실패
    throw aiError;
  } else {
    // AI 정상 종료했는데 디스크 변경 없음 (AI 가 "변경 필요 없음" 판단 등)
    updateDeck(deckId, { status: "ready" });
  }
}

type SlideMtimes = Record<string, number>;

async function snapshotSlideMtimes(dir: string): Promise<SlideMtimes> {
  if (!fssync.existsSync(dir)) return {};
  const files = await fs.readdir(dir);
  const out: SlideMtimes = {};
  for (const f of files) {
    if (!/^slide-\d+\.html?$/i.test(f)) continue;
    try {
      const stat = await fs.stat(path.join(dir, f));
      out[f] = stat.mtimeMs;
    } catch {}
  }
  return out;
}

function hasChange(a: SlideMtimes, b: SlideMtimes): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (a[k] !== b[k]) return true;
  }
  return false;
}

function runProvider({
  cmd,
  args,
  cwd,
  env,
}: {
  cmd: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
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
      reject(new Error(`일괄 수정 타임아웃 (${TIMEOUT_MS / 60000}분 초과)`));
    }, TIMEOUT_MS);

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
        reject(
          new Error(
            `AI 종료 코드 ${code ?? "?"}: ${tail.slice(0, 800) || "(빈 출력)"}`,
          ),
        );
      }
    });
  });
}

function buildBulkEditPrompt(instruction: string, provider: string): string {
  const invokeLabel = provider === "codex" ? "`codex exec`" : "`claude -p`";
  return [
    "작업 폴더의 `output/` 에 있는 슬라이드 HTML 파일들을 다음 지시대로 수정해 주세요.",
    "",
    "## 사용자 지시",
    instruction,
    "",
    "## 룰",
    "- 기본은 **기존 슬라이드의 수정**. `output/slide-NN.html` 들을 직접 편집.",
    "- 사용자가 \"슬라이드 추가\" 또는 \"OO 슬라이드 한 장 더\" 같이 *명시적으로 요청* 하면 새 `slide-NN.html` 추가 OK (파일명 zero-padded, 이전 번호 다음 idx).",
    "- 사용자가 *명시적으로 삭제* 를 요청하면, 해당 파일 삭제 후 **남은 슬라이드를 한 칸씩 앞당겨 rename** 하세요 (idx 에 gap 생기지 않게). 그 외엔 슬라이드 삭제 X.",
    "- slides-grab 의 edit / validate skill 활용 가능. skill 의 기본 규격을 임의로 바꾸지 마세요.",
    "- 텍스트의 직접 부모는 반드시 `<p>` / `<h1>`~`<h6>` / `<li>` 중 하나 유지 (수정 도구 호환).",
    "- inline 구조 (`<span style=\"color:…\">`, `<strong>` 등) 와 색깔/굵기는 *지시에 명시되지 않으면* 보존.",
    "",
    `**자동화 환경 안내** — 이건 non-interactive ${invokeLabel} 호출이라 사용자가 중간 단계에서 응답할 수 없습니다. "사용자 승인" 룰은 자동으로 받은 것으로 간주하고 끝까지 진행하세요.`,
  ].join("\n");
}
