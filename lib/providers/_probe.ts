import { spawn } from "node:child_process";

export type VersionProbe = {
  installed: boolean;
  version: string | null;
};

export async function probeVersion(
  binary: string,
  timeoutMs = 5_000,
): Promise<VersionProbe> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: VersionProbe) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    let child;
    try {
      child = spawn(binary, ["--version"], {
        stdio: ["ignore", "pipe", "pipe"],
        env: process.env,
      });
    } catch {
      finish({ installed: false, version: null });
      return;
    }

    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf-8");
    });
    child.on("error", () => finish({ installed: false, version: null }));

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish({ installed: false, version: null });
    }, timeoutMs);

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        finish({ installed: true, version: stdout.trim().split("\n")[0] || null });
      } else {
        finish({ installed: false, version: null });
      }
    });
  });
}
