import { probeVersion } from "./_probe";
import type { Provider, ProviderStatus } from "./provider";
import { getSlidesGrabStatus } from "./skills";

export const codex: Provider = {
  id: "codex",
  label: "Codex",
  async detect(): Promise<ProviderStatus> {
    const { installed, version } = await probeVersion("codex");
    const skill = installed ? getSlidesGrabStatus("codex") : null;
    return {
      id: "codex",
      label: "Codex",
      installed,
      version,
      installCommand: "npm install -g @openai/codex",
      installDocsUrl: "https://developers.openai.com/codex/cli",
      slidesGrabSkill: skill,
    };
  },
};
