export type ProviderId = "claude-code" | "codex";

export type SlidesGrabSkillStatus =
  | "installed"
  | "missing"
  | "installing"
  | "failed";

export type ProviderStatus = {
  id: ProviderId;
  label: string;
  installed: boolean;
  version: string | null;
  installCommand: string;
  installDocsUrl: string;
  // Claude Code 만 의미 있음 (codex 는 null). null = 점검 안 함.
  slidesGrabSkill: {
    status: SlidesGrabSkillStatus;
    error: string | null;
  } | null;
  // 본체 자동 설치 진행 상태. 진행 중이거나 실패했을 때만 채워짐.
  // null = idle (시도 안 했거나 이미 installed)
  bodyInstall: {
    status: "installing" | "failed";
    error: string | null;
  } | null;
};

export interface Provider {
  id: ProviderId;
  label: string;
  detect(): Promise<ProviderStatus>;
}
