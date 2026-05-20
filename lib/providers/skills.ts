import { spawn } from "node:child_process";
import fssync from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ProviderId } from "./provider";

// Claude Code / Codex 의 slides-grab "기술" (skill) 자동 점검 / 설치.
// 사용자가 직접 paste 안 해도 우리 앱이 spawn 해서 설치.
//
// 점검 디렉토리 (provider 별 fixed):
//   claude-code → ~/.claude/skills/<name>/
//   codex       → ~/.agents/skills/<name>/   (npx skills add -g 가 여기 깔음, codex 가 자동 load)
//
// 설치 명령:
//   claude-code → `claude -p "Read https://..." --dangerously-skip-permissions`
//   codex       → `npx skills add ./node_modules/slides-grab -g -a codex --yes --copy`

const REQUIRED_SKILLS = ["slides-grab-plan", "slides-grab-design"] as const;

const CLAUDE_INSTALL_PROMPT =
  "Read https://raw.githubusercontent.com/vkehfdl1/slides-grab/main/docs/installation/claude.md and follow every step.";

const TIMEOUT_MS = 5 * 60 * 1000;

export type SkillStatus = "installed" | "missing" | "installing" | "failed";

type State = {
  installing: boolean;
  lastError: string | null;
};

const stateByProvider = new Map<ProviderId, State>();

function stateFor(provider: ProviderId): State {
  let s = stateByProvider.get(provider);
  if (!s) {
    s = { installing: false, lastError: null };
    stateByProvider.set(provider, s);
  }
  return s;
}

function skillsDirFor(provider: ProviderId): string {
  const home = os.homedir();
  if (provider === "claude-code") {
    return path.join(home, ".claude", "skills");
  }
  // codex
  return path.join(home, ".agents", "skills");
}

export function isSlidesGrabInstalled(provider: ProviderId): boolean {
  const base = skillsDirFor(provider);
  return REQUIRED_SKILLS.every((name) =>
    fssync.existsSync(path.join(base, name)),
  );
}

export function getSlidesGrabStatus(provider: ProviderId): {
  status: SkillStatus;
  error: string | null;
} {
  const s = stateFor(provider);
  if (s.installing) return { status: "installing", error: null };
  if (isSlidesGrabInstalled(provider)) {
    if (s.lastError) s.lastError = null;
    return { status: "installed", error: null };
  }
  if (s.lastError) return { status: "failed", error: s.lastError };
  return { status: "missing", error: null };
}

export function startSlidesGrabInstall(provider: ProviderId): {
  started: boolean;
  reason?: string;
} {
  const s = stateFor(provider);
  if (s.installing) return { started: false, reason: "이미 설치 중" };
  if (isSlidesGrabInstalled(provider)) {
    return { started: false, reason: "이미 설치됨" };
  }

  s.installing = true;
  s.lastError = null;

  void runInstall(provider)
    .catch((err) => {
      s.lastError = err instanceof Error ? err.message : String(err);
    })
    .finally(() => {
      s.installing = false;
    });

  return { started: true };
}

async function runInstall(provider: ProviderId): Promise<void> {
  if (provider === "claude-code") {
    await runClaudeInstall();
  } else {
    await runCodexInstall();
  }
  // 설치 명령 끝났어도 실제 디렉토리 생겼는지 한 번 더 확인
  if (!isSlidesGrabInstalled(provider)) {
    throw new Error(
      "설치 명령은 끝났지만 기술 폴더가 안 생겼어요. 다시 시도해 주세요.",
    );
  }
}

function runClaudeInstall(): Promise<void> {
  return spawnP("claude", [
    "-p",
    CLAUDE_INSTALL_PROMPT,
    "--dangerously-skip-permissions",
  ]);
}

function runCodexInstall(): Promise<void> {
  // npx skills CLI 를 우리 앱 root cwd 에서 호출. ./node_modules/slides-grab 가 우리 npm dep 폴더.
  return spawnP(
    "npx",
    [
      "skills",
      "add",
      "./node_modules/slides-grab",
      "-g",
      "-a",
      "codex",
      "--yes",
      "--copy",
    ],
    process.cwd(),
  );
}

function spawnP(cmd: string, args: string[], cwd?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
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
      reject(new Error("기술 설치 타임아웃 (5분 초과)"));
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
        console.error(
          `[skills] install exited with code ${code ?? "?"}\n${tail}`,
        );
        reject(
          new Error(
            `기술 설치에 실패했어요. ${tail.slice(0, 400) || "(자세한 사유 없음)"}`,
          ),
        );
      }
    });
  });
}
