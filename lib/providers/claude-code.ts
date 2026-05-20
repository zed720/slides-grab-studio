import { probeVersion } from "./_probe";
import type { Provider, ProviderStatus } from "./provider";
import { getSlidesGrabStatus } from "./skills";

export const claudeCode: Provider = {
  id: "claude-code",
  label: "Claude Code",
  async detect(): Promise<ProviderStatus> {
    const { installed, version } = await probeVersion("claude");
    const skill = installed ? getSlidesGrabStatus("claude-code") : null;
    return {
      id: "claude-code",
      label: "Claude Code",
      installed,
      version,
      installCommand: "npm install -g @anthropic-ai/claude-code",
      installDocsUrl: "https://docs.claude.com/en/docs/claude-code/quickstart",
      slidesGrabSkill: skill,
    };
  },
};
