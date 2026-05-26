import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";
import {
  getDeck,
  updateDeck,
  type Deck,
  type DeckStatus,
} from "@/lib/db/queries/decks";
import {
  getCustomTemplate,
  parseBrand,
} from "@/lib/db/queries/custom-templates";
import { insertSlide, listSlidesByDeck } from "@/lib/db/queries/slides";
import { brandKitToInstruction } from "@/lib/custom-templates/instruction";
import { buildClaudeArgs } from "@/lib/providers/claude-args";
import { BITREE_DESIGN_INSTRUCTIONS } from "@/lib/slides-grab/bitree-template";
import {
  dataRoot,
  deckDir,
  deckOutputDir,
  ensureDir,
} from "@/lib/storage";

// 진짜 AI 호출 generator.
// provider 의 non-interactive 모드 (`claude -p` / `codex exec`) 로 spawn,
// cwd = data/decks/<id>/. AI 는 `uploads/_brief.md` 와 같은 폴더의 첨부 파일을
// 읽어 `output/slide-NN.html` 들을 작성한다.

const generating = new Set<string>();
const TIMEOUT_MS = 20 * 60 * 1000;

export function isGenerating(deckId: string): boolean {
  return generating.has(deckId);
}

// 슬라이드 분량은 여러 신호의 *최대값* 으로 결정한다 — 디스크에 실제로 있는
// slide-NN.html 의 max idx, outline.md 의 Slide Count, 사용자 입력 분량 중
// 가장 큰 값. 셋 다 0 일 때만 fallback 6 사용 (시작 직후 UI 가 "0/0" 표시
// 안 되게). 이전 버그: fallback 6 을 max 인자에 넣어서 outline 이 5 면 항상
// 6 으로 올라가 마지막에 "만드는 중..." 가짜 placeholder 표시됨.
// AI 가 bulk-edit 으로 슬라이드를 추가했거나 outline 의 원래 계획보다 더 많이
// 만들면 디스크 max 가 우선이라 UI 가 모든 슬라이드를 표시한다.
export function plannedSlideTotal(deck: Pick<Deck, "id" | "source_text">): number {
  // 1) 디스크의 실제 slide-NN.html 의 max idx
  let diskMax = 0;
  try {
    const outDir = deckOutputDir(deck.id);
    if (fssync.existsSync(outDir)) {
      const files = fssync.readdirSync(outDir);
      diskMax = files
        .map((f) => /^slide-(\d+)\.html?$/i.exec(f))
        .filter((m): m is RegExpExecArray => m !== null)
        .map((m) => parseInt(m[1], 10))
        .reduce((a, b) => Math.max(a, b), 0);
    }
  } catch {}

  // 2) outline.md 의 Slide Count (AI 의 원래 계획)
  let outlineCount = 0;
  const outlineCandidates = [
    path.join(deckDir(deck.id), "slide-outline.md"),
    path.join(deckOutputDir(deck.id), "slide-outline.md"),
    path.join(deckDir(deck.id), "uploads", "slide-outline.md"),
  ];
  for (const outlinePath of outlineCandidates) {
    if (!fssync.existsSync(outlinePath)) continue;
    try {
      const outline = fssync.readFileSync(outlinePath, "utf-8");
      const m = /Slide Count[\s*:`]+(\d+)/i.exec(outline);
      if (m) {
        outlineCount = parseInt(m[1], 10);
        break;
      }
      const headers = outline.match(/^###\s+Slide\s+\d+\b/gm);
      if (headers && headers.length > 0) {
        outlineCount = headers.length;
        break;
      }
    } catch {}
  }

  // 3) 사용자 입력의 분량 메타
  let userCount = 0;
  const m = /분량:\s*([^\n]+)/.exec(deck.source_text ?? "");
  if (m) {
    const v = m[1].trim();
    if (v.startsWith("5")) userCount = 5;
    else if (v.startsWith("10")) userCount = 10;
    else if (v.startsWith("15")) userCount = 15;
    else if (v.startsWith("20")) userCount = 20;
  }

  const max = Math.max(diskMax, outlineCount, userCount);
  return max > 0 ? max : 6;
}

export function isUserSlideCountSpecified(deck: Pick<Deck, "source_text">): boolean {
  const m = /분량:\s*([^\n]+)/.exec(deck.source_text ?? "");
  if (!m) return false;
  const v = m[1].trim();
  return (
    v.startsWith("5") ||
    v.startsWith("10") ||
    v.startsWith("15") ||
    v.startsWith("20")
  );
}

export function startGeneration(deckId: string): { started: boolean } {
  // 옛 흐름: plan + design + validate 를 한 번에. draft → generating → ready.
  // 새 deck 은 startPlanning → startDesign 두 단계로.
  const deck = getDeck(deckId);
  if (!deck) throw new Error("Deck not found");
  if (generating.has(deckId)) return { started: false };
  if (deck.status !== "draft") return { started: false };

  generating.add(deckId);
  updateDeck(deckId, { status: "generating" });

  void runGeneration(deckId)
    .catch((err) => {
      console.error("[deck-generator] failed", deckId, err);
      try {
        updateDeck(deckId, { status: "failed" });
      } catch {}
    })
    .finally(() => generating.delete(deckId));

  return { started: true };
}

// 새 흐름: 1단계 plan only — slide-outline.md 만 만들고 멈춤.
//   draft → outlining → outline-ready
export function startPlanning(deckId: string): { started: boolean } {
  const deck = getDeck(deckId);
  if (!deck) throw new Error("Deck not found");
  if (generating.has(deckId)) return { started: false };
  if (deck.status !== "draft") return { started: false };

  generating.add(deckId);
  updateDeck(deckId, { status: "outlining" });

  void runPlanning(deckId)
    .catch((err) => {
      console.error("[deck-planner] failed", deckId, err);
      try {
        updateDeck(deckId, { status: "failed" });
      } catch {}
    })
    .finally(() => generating.delete(deckId));

  return { started: true };
}

// 새 흐름: 2단계 design + validate — outline.md 그대로 사용해서 슬라이드 만들기.
//   outline-ready → generating → ready
export function startDesign(deckId: string): { started: boolean } {
  const deck = getDeck(deckId);
  if (!deck) throw new Error("Deck not found");
  if (generating.has(deckId)) return { started: false };
  if (deck.status !== "outline-ready") return { started: false };

  generating.add(deckId);
  updateDeck(deckId, { status: "generating" });

  void runDesign(deckId)
    .catch((err) => {
      console.error("[deck-designer] failed", deckId, err);
      try {
        updateDeck(deckId, { status: "failed" });
      } catch {}
    })
    .finally(() => generating.delete(deckId));

  return { started: true };
}

async function runPlanning(deckId: string): Promise<void> {
  const deck = getDeck(deckId);
  if (!deck) throw new Error("Deck not found");
  const wd = deckDir(deckId);
  ensureDir(wd);

  const prompt = buildPlanPrompt(deck);
  await spawnAi(deck, prompt, wd, deckId);

  // outline 파일이 실제로 생겼는지 확인
  const outlinePath = path.join(wd, "slide-outline.md");
  if (!fssync.existsSync(outlinePath)) {
    throw new Error("AI 가 outline 파일을 만들지 못했어요.");
  }
  updateDeck(deckId, { status: "outline-ready" });
}

async function runDesign(deckId: string): Promise<void> {
  const deck = getDeck(deckId);
  if (!deck) throw new Error("Deck not found");
  const wd = deckDir(deckId);
  ensureDir(wd);
  ensureDir(deckOutputDir(deckId));

  const prompt = buildDesignPrompt(deck);
  await spawnAi(deck, prompt, wd, deckId);

  await syncSlidesFromDisk(deckId);
  const finalSlides = listSlidesByDeck(deckId);
  if (finalSlides.length === 0) {
    throw new Error("AI 가 슬라이드를 한 장도 만들지 못했어요.");
  }
  updateDeck(deckId, { status: "ready" });
}

// generator/planner/designer 공통 — provider 분기 + spawn
async function spawnAi(
  deck: Deck,
  prompt: string,
  wd: string,
  deckId: string,
): Promise<void> {
  const provider = deck.provider_id ?? "claude-code";
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
  console.log(`[deck-generator] ${deckId}: spawn ${cmd} (cwd=${wd})`);
  await runProvider({ cmd, args, cwd: wd, env, deckId });
}

async function runGeneration(deckId: string): Promise<void> {
  const deck = getDeck(deckId);
  if (!deck) throw new Error("Deck not found");

  const wd = deckDir(deckId);
  ensureDir(wd);
  ensureDir(deckOutputDir(deckId));

  const prompt = buildPrompt(deck);

  const provider = deck.provider_id ?? "claude-code";

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

  console.log(`[deck-generator] ${deckId}: spawn ${cmd} (cwd=${wd})`);

  await runProvider({ cmd, args, cwd: wd, env, deckId });

  await syncSlidesFromDisk(deckId);

  const finalSlides = listSlidesByDeck(deckId);
  if (finalSlides.length === 0) {
    throw new Error("AI 가 슬라이드를 한 장도 만들지 못했어요.");
  }

  updateDeck(deckId, { status: "ready" });
}

function runProvider({
  cmd,
  args,
  cwd,
  env,
  deckId,
}: {
  cmd: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  deckId: string;
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
      const s = c.toString("utf-8");
      stdoutTail = (stdoutTail + s).slice(-2000);
      // 생성 도중 디스크 sync 도 시도 (status API 가 별도로 하지만 안전망)
      void syncSlidesFromDisk(deckId).catch(() => {});
    });
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

export type DeckStage =
  | "planning" // AI 가 발표 구조(slide-outline.md) 잡는 중
  | "designing" // 슬라이드 한 장씩 그리는 중
  | "finalizing" // 모든 슬라이드 도착했고 마무리/validate 중
  | "bulk-editing" // 일괄 수정 중 (사용자 자연어 지시)
  | "ready"
  | "failed";

// 디스크 신호로 현재 단계 추정. 추정이라 100% 정확하진 않지만 UI 라벨 용도로 충분.
export function deriveStage(
  deckId: string,
  deckStatus: DeckStatus,
  slidesCount: number,
  plannedTotal: number,
  bulkEditing = false,
): DeckStage {
  if (bulkEditing) return "bulk-editing";
  if (deckStatus === "ready") return "ready";
  if (deckStatus === "failed") return "failed";
  // outline 단계 — 새 흐름의 plan only / 검토 대기
  if (deckStatus === "outlining") return "planning";
  if (deckStatus === "outline-ready") return "designing"; // 검토 끝나면 design 시작 직전
  if (slidesCount >= plannedTotal && plannedTotal > 0) return "finalizing";
  if (slidesCount > 0) return "designing";
  // 아직 슬라이드 0개. outline 있으면 design 시작 직전, 없으면 planning.
  const outlinePath = path.join(deckDir(deckId), "slide-outline.md");
  if (fssync.existsSync(outlinePath)) return "designing";
  return "planning";
}

export async function syncSlidesFromDisk(deckId: string): Promise<number> {
  const dir = deckOutputDir(deckId);
  if (!fssync.existsSync(dir)) return 0;
  const files = await fs.readdir(dir);
  const existing = new Set(listSlidesByDeck(deckId).map((s) => s.idx));

  let added = 0;
  for (const f of files.sort()) {
    const m = /^slide-(\d+)\.html?$/i.exec(f);
    if (!m) continue;
    const idx = parseInt(m[1], 10) - 1; // slide-01 = idx 0
    if (idx < 0 || existing.has(idx)) continue;
    try {
      insertSlide({ deckId, idx, htmlPath: path.join(dir, f) });
      existing.add(idx);
      added++;
    } catch {
      // 동시 sync 로 중복 insert 시도가 있을 수 있음 — UNIQUE 제약 위반은 무시
    }
  }
  return added;
}

function buildPlanPrompt(deck: Deck): string {
  // 1단계 — plan skill 만 호출. design / validate 단계는 절대 X.
  const style = styleInstruction(deck, { withFrontmatter: true });

  const isCodex = deck.provider_id === "codex";
  const toolLabel = isCodex ? "Codex" : "Claude Code";
  const invokeLabel = isCodex ? "`codex exec`" : "`claude -p`";

  return [
    "작업 폴더의 `uploads/_brief.md` 와 같은 폴더 안의 첨부 파일들을 바탕으로 발표 자료의 **outline 만** 만들어 주세요.",
    "",
    `**slides-grab 의 plan skill** 만 사용 (이 사용자의 ${toolLabel} 에 설치돼 있어요). 결과는 작업 폴더 root 의 \`slide-outline.md\` 에 저장.`,
    "",
    "**중요 — design / validate 단계는 절대 실행하지 마세요.** 슬라이드 HTML 파일 (`slide-NN.html`) 도 만들지 마세요. 오직 outline 만 만들고 곧바로 종료.",
    "",
    "**분량 — 사용자 명시 우선**:",
    "  1. `_brief.md` 의 `발표 의도 > 분량:` 줄에 사용자가 분량을 명시했으면 **그 분량을 그대로 따르세요**. \"5장 안팎\" 이면 정확히 5장, \"안팎\" 의 폭은 ±1장 이내.",
    "  2. 분량 명시 없으면 첨부 파일의 슬라이드 구분 (예: `# 슬라이드 N`, `## Slide N`, `---` 구분) 따르세요.",
    "  3. 위 둘 다 없을 때만 AI 가 자유 추정 (보통 5~10장).",
    "  4. 표지·목차 같은 보조 슬라이드를 *임의로* 추가하지 마세요. 분량 안에 표지를 포함할지는 콘텐츠 양에 따라 결정.",
    "",
    `**자동화 환경 안내** — 이건 non-interactive ${invokeLabel} 호출이라 사용자가 중간 단계에서 응답할 수 없습니다. plan skill 의 "사용자 승인" 룰은 자동으로 받은 것으로 간주.`,
    style,
  ].filter((s) => s !== "").join("\n");
}

function buildDesignPrompt(deck: Deck): string {
  // 2단계 — outline.md 가 이미 디스크에 있음 (사용자가 검토/편집 끝). design + validate 만.
  const isCodex = deck.provider_id === "codex";
  const toolLabel = isCodex ? "Codex" : "Claude Code";
  const invokeLabel = isCodex ? "`codex exec`" : "`claude -p`";

  const styleBlock = styleInstruction(deck, { withFrontmatter: false });

  return [
    "작업 폴더 root 의 `slide-outline.md` 가 사용자 검토를 거친 최종본입니다. 이 outline 을 그대로 사용해서 슬라이드를 만들어 주세요.",
    "",
    `**slides-grab 의 design + validate skill** 만 사용 (이 사용자의 ${toolLabel} 에 설치돼 있어요). plan skill 은 이미 끝났으니 다시 실행하지 마세요. outline 의 내용을 임의로 바꾸지 마세요.`,
    "",
    "결과는 `output/` 에 `slide-01.html`, `slide-02.html`, … 형식으로 저장.",
    "",
    `**자동화 환경 안내** — 이건 non-interactive ${invokeLabel} 호출이라 사용자가 중간 단계에서 응답할 수 없습니다. design / validate 의 "사용자 승인" 룰은 자동으로 받은 것으로 간주하고 한 번에 끝까지 진행하세요.`,
    "",
    "**우리 앱의 수정 도구 호환 (중요)** — 사용자가 완성된 슬라이드를 클릭해서 텍스트를 직접 수정합니다. 모든 텍스트는 반드시 `<p>` / `<h1>`~`<h6>` / `<li>` 안에 넣어 주세요. `<div>` 안에 텍스트를 직접 넣으면 수정 도구가 텍스트 박스로 인식 못 합니다.",
    styleBlock,
  ].filter((s) => s !== "").join("\n");
}

// template_id 별 디자인 instruction —
//   "bitree" → slides-grab 의 style id 가 아니라 우리 자체 디자인 spec 박음
//   기타 → slides-grab list-styles 의 id 그대로
function styleInstruction(
  deck: Deck,
  opts: { withFrontmatter: boolean },
): string {
  if (!deck.template_id) return "";
  if (deck.template_id === "bitree") {
    // 우리 자체 디자인. style id 가 slides-grab 에 없으니 instruction 으로 강제.
    const fm = opts.withFrontmatter
      ? " outline 의 frontmatter 의 style 값은 비워두거나 `custom-bitree` 로 명시."
      : "";
    return BITREE_DESIGN_INSTRUCTIONS + fm;
  }
  // 사용자가 만든 양식 — DB 의 custom_templates 에서 brand kit 읽어 instruction 생성.
  // template_id 형식: "custom:<uuid>"
  if (deck.template_id.startsWith("custom:")) {
    const customId = deck.template_id.slice("custom:".length);
    const tpl = getCustomTemplate(customId);
    if (!tpl || tpl.deleted_at !== null) {
      // 사용자가 양식을 지웠으면 instruction 없이 진행 (slides-grab 기본 디자인).
      return "";
    }
    const brand = parseBrand(tpl);
    const logoAbs = brand.logoPath
      ? path.resolve(dataRoot(), brand.logoPath)
      : null;
    const instruction = brandKitToInstruction({
      brand,
      templateName: tpl.name,
      logoAbsolutePath: logoAbs,
    });
    const fm = opts.withFrontmatter
      ? " outline 의 frontmatter 의 style 값은 비워두거나 `custom-user` 로 명시."
      : "";
    return instruction + fm;
  }
  return opts.withFrontmatter
    ? `디자인 스타일: \`${deck.template_id}\` (slides-grab list-styles 의 id). outline 의 frontmatter 에 \`style: ${deck.template_id}\` 로 명시.`
    : `디자인 스타일: \`${deck.template_id}\` (slides-grab list-styles 의 id).`;
}

function buildPrompt(deck: Deck): string {
  // 핵심만 — skill 자체가 규격을 다 알고 있다.
  // 우리가 추가해야 하는 정보는: (1) 입력 파일 위치, (2) 출력 위치,
  // (3) non-interactive 환경 (사용자 중간 응답 없음 — 자동 승인으로 끝까지),
  // (4) 선택된 디자인 스타일이 있으면 그 id (bitree 면 자체 instruction).
  const style = styleInstruction(deck, { withFrontmatter: false });

  const isCodex = deck.provider_id === "codex";
  const toolLabel = isCodex ? "Codex" : "Claude Code";
  const invokeLabel = isCodex ? "`codex exec`" : "`claude -p`";

  return [
    "작업 폴더의 `uploads/_brief.md` 와 같은 폴더 안의 첨부 파일들을 바탕으로 발표 자료를 만들어 주세요.",
    "",
    `**slides-grab 의 plan / design / validate skill** 을 그대로 사용하세요 (이 사용자의 ${toolLabel} 에 설치돼 있어요). skill 의 기본 규격 (사이즈/태그/스타일/분량) 을 따르고 임의로 바꾸지 마세요.`,
    "",
    "결과는 `output/` 에 `slide-01.html`, `slide-02.html`, … 형식으로 저장.",
    "",
    "**자료 분량 존중** — 첨부 파일이 슬라이드 단위로 미리 나뉘어 있으면 (예: `# 슬라이드 N`, `## Slide N`, `---` 구분 등), 그 분량과 구분을 그대로 따르세요. 표지·목차 같은 보조 슬라이드를 임의로 추가하지 마세요.",
    "",
    `**자동화 환경 안내** — 이건 non-interactive ${invokeLabel} 호출이라 사용자가 중간 단계에서 응답할 수 없습니다. plan / design / validate 의 "사용자 승인" 룰은 자동으로 받은 것으로 간주하고 한 번에 끝까지 진행하세요.`,
    "",
    "**우리 앱의 수정 도구 호환 (중요)** — 사용자가 완성된 슬라이드를 클릭해서 텍스트를 직접 수정합니다. 모든 텍스트는 반드시 `<p>` / `<h1>`~`<h6>` / `<li>` 안에 넣어 주세요. `<div>` 안에 텍스트를 직접 넣으면 수정 도구가 텍스트 박스로 인식 못 합니다. (그 안의 부분 강조 / inline styling 은 자유롭게 — 우리 수정 도구가 inline 자식 구조를 보존합니다.)",
    style,
  ].filter((s) => s !== "").join("\n");
}
