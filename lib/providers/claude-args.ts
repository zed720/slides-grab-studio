import { getClaudeModel } from "@/lib/db/queries/settings";

// claude -p ... --dangerously-skip-permissions [--model X]
// 사용자가 화면 1 에서 모델 명시한 경우 그 모델로 호출. 빈 값이면 Claude default.
export function buildClaudeArgs(prompt: string): string[] {
  const args = ["-p", prompt, "--dangerously-skip-permissions"];
  const model = getClaudeModel();
  if (model) {
    args.push("--model", model);
  }
  return args;
}
