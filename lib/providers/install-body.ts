import { spawn } from "node:child_process";
import type { ProviderId } from "./provider";

// Claude Code / Codex *본체* 의 자동 설치. (slides-grab "기술" 은 skills.ts 가 따로 처리.)
//
// 명령:
//   claude-code → `npm install -g @anthropic-ai/claude-code`
//   codex       → `npm install -g @openai/codex`
//
// npm 글로벌 install 은 권한 (EACCES) 으로 막힐 수 있다. 그 경우 stderr 에 명확한
// 메시지가 떨어지므로 사용자에게 그대로 노출 + UI 가 fallback 으로 터미널 명령 안내.

const INSTALL_TIMEOUT_MS = 5 * 60 * 1000;

const INSTALL_COMMAND: Record<ProviderId, { cmd: string; args: string[] }> = {
  "claude-code": {
    cmd: "npm",
    args: ["install", "-g", "@anthropic-ai/claude-code"],
  },
  codex: {
    cmd: "npm",
    args: ["install", "-g", "@openai/codex"],
  },
};

export type BodyInstallStatus = "installing" | "failed";

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

// detect() 가 호출됨 — 본체가 설치되어 있으면 idle 상태로 리셋
export function clearBodyInstallError(provider: ProviderId): void {
  const s = stateFor(provider);
  s.lastError = null;
}

export function getBodyInstallStatus(provider: ProviderId): {
  status: BodyInstallStatus;
  error: string | null;
} | null {
  const s = stateFor(provider);
  if (s.installing) return { status: "installing", error: null };
  if (s.lastError) return { status: "failed", error: s.lastError };
  return null;
}

export function startBodyInstall(provider: ProviderId): {
  started: boolean;
  reason?: string;
} {
  const s = stateFor(provider);
  if (s.installing) return { started: false, reason: "이미 설치 중" };

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
  const { cmd, args } = INSTALL_COMMAND[provider];
  return spawnP(cmd, args);
}

function spawnP(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
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
      reject(new Error("설치 타임아웃 (5분 초과)"));
    }, INSTALL_TIMEOUT_MS);

    child.on("error", (err) => {
      clearTimeout(timer);
      // npm 명령 자체가 없는 경우 (Node.js 미설치) — 별도 안내
      const msg =
        (err as NodeJS.ErrnoException).code === "ENOENT"
          ? "npm 명령을 찾지 못했어요. Node.js 가 설치되어 있는지 확인해 주세요."
          : err.message;
      reject(new Error(msg));
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
        return;
      }
      const tail = stderr || stdoutTail;
      console.error(
        `[install-body] ${cmd} ${args.join(" ")} exited with code ${code ?? "?"}\n${tail}`,
      );
      // EACCES (권한) 케이스 — npm global prefix 가 시스템 경로일 때 발생
      if (tail.includes("EACCES") || tail.includes("permission denied")) {
        reject(
          new Error(
            "권한 문제로 설치하지 못했어요. 아래 터미널 명령을 직접 실행해 주세요.",
          ),
        );
        return;
      }
      reject(
        new Error(
          `설치에 실패했어요. ${tail.slice(0, 400) || "(자세한 사유 없음)"}`,
        ),
      );
    });
  });
}
