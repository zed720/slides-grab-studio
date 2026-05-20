import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

let cachedBinPath: string | null = null;

function resolveBinPath(): string {
  if (cachedBinPath) return cachedBinPath;
  // pnpm/npm both place the slides-grab package at <cwd>/node_modules/slides-grab.
  // We avoid require.resolve here because Next.js/Turbopack rewrites subpath
  // resolutions in unexpected ways for server routes.
  const candidate = path.join(
    process.cwd(),
    "node_modules",
    "slides-grab",
    "bin",
    "ppt-agent.js",
  );
  if (!fs.existsSync(candidate)) {
    throw new Error(
      `slides-grab CLI not found at ${candidate}. 'pnpm install' 이 끝났는지 확인해 주세요.`,
    );
  }
  cachedBinPath = candidate;
  return cachedBinPath;
}

export type SlidesGrabResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

export async function runSlidesGrab(
  args: string[],
  opts: { cwd?: string; timeoutMs?: number } = {},
): Promise<SlidesGrabResult> {
  const bin = resolveBinPath();
  const timeoutMs = opts.timeoutMs ?? 60_000;

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [bin, ...args], {
      cwd: opts.cwd ?? process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf-8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf-8");
    });

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(
        new Error(
          `slides-grab ${args.join(" ")} timed out after ${timeoutMs}ms`,
        ),
      );
    }, timeoutMs);

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode: code ?? -1 });
    });
  });
}

export async function getVersion(): Promise<string> {
  const { stdout, exitCode, stderr } = await runSlidesGrab(["--version"]);
  if (exitCode !== 0) {
    throw new Error(
      `slides-grab --version exited with code ${exitCode}: ${stderr.trim()}`,
    );
  }
  return stdout.trim();
}
