import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { ARCHETYPES } from "./archetypes";
import type {
  AIArchetypeEntry,
  ArchetypeKey,
  BrandKit,
} from "./types";
import { buildClaudeArgs } from "@/lib/providers/claude-args";
import { customTemplatesDir, dataRoot, ensureDir } from "@/lib/storage";

// AI 가 archetype 옵션 HTML 을 생성. claude/codex CLI spawn → tmp 디렉토리에
// output-1.html … output-N.html 작성 → 검증 → AIArchetypeEntry 로 반환.
// 결과 HTML 은 brand 가 이미 적용된 final snapshot. tmp 디렉토리는 생성 후 정리.

const TIMEOUT_MS = 4 * 60 * 1000; // 4분 — 사용자 토큰 소모 큰 작업 아님

export type GenerateInput = {
  templateId: string;
  brand: BrandKit;
  archKey: ArchetypeKey;
  prompt?: string;
  chips?: string[];
  count: number; // 1-3
  provider: "claude-code" | "codex";
  logoAbsolutePath: string | null;
};

export async function generateArchetypeOptions(
  input: GenerateInput,
): Promise<AIArchetypeEntry[]> {
  const meta = ARCHETYPES.find((a) => a.key === input.archKey);
  if (!meta) throw new Error(`알 수 없는 archetype: ${input.archKey}`);

  // 작업 디렉토리 — custom-templates/<id>/generations/<jobId>/
  const jobId = randomBytes(6).toString("hex");
  const wd = path.join(
    customTemplatesDir(input.templateId),
    "generations",
    jobId,
  );
  ensureDir(wd);

  try {
    const prompt = buildGenerationPrompt(input, meta.label);
    await spawnProvider(input.provider, prompt, wd);

    // 결과 파일 읽고 검증
    const entries: AIArchetypeEntry[] = [];
    for (let i = 1; i <= input.count; i++) {
      const file = path.join(wd, `output-${i}.html`);
      let html: string;
      try {
        html = await fs.readFile(file, "utf-8");
      } catch {
        // AI 가 일부만 만들었을 수 있음 — 만들어진 것만 사용
        continue;
      }
      const cleaned = validateAndClean(html);
      if (!cleaned) continue;

      const now = Date.now();
      const entry: AIArchetypeEntry = {
        id: `ai-${now}-${randomBytes(3).toString("hex")}`,
        archKey: input.archKey,
        name: buildEntryName(input.prompt ?? "", i),
        description: input.prompt?.trim() || "AI 가 만든 모양",
        html: cleaned,
        createdAt: now + i, // 순서 보장
      };
      entries.push(entry);
    }

    if (entries.length === 0) {
      throw new Error(
        "AI 가 결과를 못 만들었어요. 잠시 후 다시 시도하거나 요청 문장을 바꿔보세요.",
      );
    }
    return entries;
  } finally {
    // cleanup — 영구 저장은 brand_json 안 html string 으로, 디스크 폴더는 제거
    await fs.rm(wd, { recursive: true, force: true }).catch(() => {});
  }
}

function buildEntryName(prompt: string, idx: number): string {
  const trimmed = prompt.trim();
  if (!trimmed) {
    const d = new Date();
    return `${d.getMonth() + 1}/${d.getDate()} AI 옵션 ${idx}`;
  }
  // 너무 길면 자름
  const short = trimmed.length > 20 ? trimmed.slice(0, 20) + "…" : trimmed;
  return `${short} (${idx})`;
}

function buildGenerationPrompt(
  input: GenerateInput,
  archetypeLabel: string,
): string {
  const { brand, count, prompt, chips, logoAbsolutePath } = input;
  const userRequest = prompt?.trim() || "(특별한 요청 없음 — 일반적인 모양)";
  const chipText = chips && chips.length > 0 ? chips.join(", ") : "(없음)";

  const logoHint = logoAbsolutePath
    ? `로고를 표시할 위치엔 \`<img src="${logoAbsolutePath}" alt="로고" style="width:44px;height:44px;object-fit:contain"/>\` 사용 (절대 경로 그대로).`
    : `로고 자리엔 \`<span>BR</span>\` placeholder 사용 (회사 약자, 24~36px).`;

  return [
    `당신은 발표 자료 슬라이드의 HTML/CSS 디자이너입니다. 사용자 회사 양식의 \`${archetypeLabel}\` 모양을 ${count} 가지 만들어 주세요.`,
    "",
    "**필수 사항**",
    "* 결과는 작업 폴더의 `output-1.html`, `output-2.html` … 식 파일로 저장하세요. 다른 파일은 만들지 마세요.",
    "* 각 파일은 한 장의 슬라이드 — 완전한 `<!doctype html><html><head><meta charset=\"utf-8\"><style>...</style></head><body>...</body></html>` 구조.",
    "* 슬라이드 비례 16:9 (예: viewport 960×540 또는 1280×720 기준). body 에 fixed width/height 박지 말고 `html, body { width:100%; height:100%; }` + body 내부에 padding/flex 로 레이아웃.",
    `* **${count}장이 서로 시각적으로 달라야** 합니다 — 레이아웃 / 강조 위치 / 색 사용 비율 등 차별화.`,
    "* `<script>` 태그 절대 사용 X, 외부 fetch X, 외부 폰트 X (시스템 폰트 + 사용자 폰트 패밀리만).",
    "",
    "**사용자 회사 브랜드 (모든 옵션에 적용)**",
    `* 주 색상 \`${brand.primaryColor}\` — 제목·헤딩·강조`,
    `* 강조 색상 \`${brand.accentColor}\` — 포인트·rule line·badge`,
    `* 본문 텍스트 색은 주 색상의 어두운 계열 또는 \`#1f2937\``,
    `* 폰트 패밀리: \`'${brand.fontFamily}', -apple-system, BlinkMacSystemFont, sans-serif\``,
    `* ${logoHint}`,
    "",
    `**Archetype 종류**: ${archetypeLabel}`,
    sampleContentHint(input.archKey),
    "",
    "**사용자 요청 (자유 텍스트)**",
    `> ${userRequest}`,
    "",
    `**자주 쓰는 옵션 칩들 (참고)**: ${chipText}`,
    "",
    "**작업 안내** — 이 호출은 non-interactive 입니다. 중간 승인 묻지 말고 곧바로 파일 ${count}개 작성 후 종료.",
    "",
    "이제 시작하세요.",
  ].join("\n");
}

function sampleContentHint(archKey: ArchetypeKey): string {
  // 각 archetype 별로 어떤 sample 텍스트를 채울지 AI 에게 안내.
  switch (archKey) {
    case "cover":
      return "* 제목: \"2026년 상반기 사업 계획\" 같은 발표 표지 제목 + 부제 + 로고 + 발표자/팀명";
    case "toc":
      return "* 4-5 항목의 목차 리스트 (\"사업 현황\", \"주요 성과\", \"향후 계획\", \"마무리\" 등)";
    case "body":
      return "* 한 핵심 주제 + 본문 문단 또는 3-5 불릿 포인트";
    case "table":
      return "* 분기별 매출 표 (4행 × 3열) 또는 주요 지표 카드 3개";
    case "chart":
      return "* 막대 차트 (5 막대, 마지막 강조) 또는 큰 숫자 (3.4×) + 라벨";
    case "image":
      return "* 사진 영역 (배경 그라데이션으로 대체) + 짧은 케이스 설명 또는 풀-사진 오버레이 + 메시지";
    case "closing":
      return "* \"감사합니다\" 또는 \"Thank you\" + 연락처 한 줄";
  }
}

function validateAndClean(html: string): string | null {
  const trimmed = html.trim();
  if (trimmed.length < 50 || trimmed.length > 80_000) return null;
  // script 태그 제거 (안전 — AI 가 prompt 무시하고 박았어도 차단)
  const noScript = trimmed.replace(
    /<script[\s\S]*?<\/script>/gi,
    "<!-- script removed -->",
  );
  // 기본적인 HTML 구조 확인
  if (!/<html[\s>]/i.test(noScript)) return null;
  if (!/<body[\s>]/i.test(noScript)) return null;
  return noScript;
}

function spawnProvider(
  provider: "claude-code" | "codex",
  prompt: string,
  wd: string,
): Promise<void> {
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
  console.log(
    `[ai-archetype] spawn ${cmd} (cwd=${wd.replace(dataRoot(), "<data>")})`,
  );

  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: wd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    });
    let stderr = "";
    child.stdout?.on("data", () => {});
    child.stderr?.on("data", (c: Buffer) => {
      stderr = (stderr + c.toString("utf-8")).slice(-4000);
    });
    const timer = setTimeout(() => {
      try {
        if (child.pid) process.kill(-child.pid, "SIGKILL");
      } catch {}
      reject(new Error(`AI 호출 타임아웃 (${TIMEOUT_MS / 60000}분 초과)`));
    }, TIMEOUT_MS);
    child.on("error", (err) => {
      clearTimeout(timer);
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        reject(
          new Error(
            `${provider === "codex" ? "Codex" : "Claude Code"} CLI 를 찾을 수 없어요. 화면 1 (AI 도구 설치 확인) 에서 설치해 주세요.`,
          ),
        );
      } else {
        reject(err);
      }
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
      } else {
        const tail = stderr.slice(0, 600) || "(빈 출력)";
        reject(new Error(`AI 종료 코드 ${code ?? "?"}: ${tail}`));
      }
    });
  });
}
