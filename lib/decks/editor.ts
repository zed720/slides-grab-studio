import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { getDeck } from "@/lib/db/queries/decks";
import { deckOutputDir } from "@/lib/storage";

type EditorSlot = {
  child: ChildProcess;
  port: number;
  deckId: string;
};

const g = globalThis as unknown as { __slidesGrabEditor?: EditorSlot };

function resolveSlidesGrabBin(): string {
  const candidate = path.join(
    process.cwd(),
    "node_modules",
    "slides-grab",
    "bin",
    "ppt-agent.js",
  );
  if (!fs.existsSync(candidate)) {
    throw new Error("slides-grab CLI not found");
  }
  return candidate;
}

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (addr && typeof addr === "object") {
        const port = addr.port;
        server.close((err) => (err ? reject(err) : resolve(port)));
      } else {
        reject(new Error("Could not allocate port"));
      }
    });
  });
}

export function getActiveEditor(): {
  deckId: string;
  port: number;
} | null {
  if (!g.__slidesGrabEditor) return null;
  if (g.__slidesGrabEditor.child.killed) {
    g.__slidesGrabEditor = undefined;
    return null;
  }
  const { deckId, port } = g.__slidesGrabEditor;
  return { deckId, port };
}

export function stopEditor(): void {
  const slot = g.__slidesGrabEditor;
  if (!slot) return;
  killProcessGroup(slot.child.pid);
  g.__slidesGrabEditor = undefined;
}

function killProcessGroup(pid: number | undefined): void {
  if (!pid) return;
  // detached spawn 이므로 child 가 새 process group 의 leader.
  // -pid 로 SIGTERM → 1초 뒤 SIGKILL 로 완전 종료.
  try {
    process.kill(-pid, "SIGTERM");
  } catch {}
  setTimeout(() => {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {}
  }, 1000).unref();
}

export async function startEditor(deckId: string): Promise<{ port: number }> {
  const deck = getDeck(deckId);
  if (!deck) throw new Error("Deck not found");

  // 이미 같은 deck 의 에디터가 떠 있으면 재사용
  const existing = getActiveEditor();
  if (existing && existing.deckId === deckId) {
    return { port: existing.port };
  }
  if (existing) {
    stopEditor();
  }

  const slidesDir = deckOutputDir(deckId);
  if (!fs.existsSync(slidesDir)) {
    throw new Error("아직 슬라이드 파일이 없어요. 먼저 만들기를 끝내주세요.");
  }

  const bin = resolveSlidesGrabBin();
  const port = await findFreePort();

  const child = spawn(
    process.execPath,
    [bin, "edit", "--slides-dir", slidesDir, "--port", String(port)],
    {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
      detached: true, // 새 process group → 손주까지 한꺼번에 종료 가능
    },
  );

  // HMR 로 부모가 reload 될 때 child 가 같이 죽지 않도록 분리
  child.unref();

  let resolved = false;
  let buf = "";

  return new Promise<{ port: number }>((resolve, reject) => {
    const timer = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      try {
        child.kill("SIGKILL");
      } catch {}
      reject(new Error("에디터가 시작되지 않았어요 (10초 초과)."));
    }, 10_000);

    child.stdout?.on("data", (chunk: Buffer) => {
      buf += chunk.toString("utf-8");
      if (!resolved && /Local:\s*https?:\/\//.test(buf)) {
        resolved = true;
        clearTimeout(timer);
        g.__slidesGrabEditor = { child, port, deckId };
        resolve({ port });
      }
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      buf += chunk.toString("utf-8");
    });

    child.on("error", (err) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      reject(err);
    });

    child.on("exit", (code) => {
      if (g.__slidesGrabEditor?.child === child) {
        g.__slidesGrabEditor = undefined;
      }
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        reject(
          new Error(
            `에디터가 시작 전 종료됐어요 (exit ${code ?? "?"}). 로그: ${buf.slice(0, 400)}`,
          ),
        );
      }
    });
  });
}
