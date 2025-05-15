import type { ConfigWizardState } from "@/views/configWizard/types";
import type { ExecutionResultsState } from "@/views/executionResults/typeDefs";
import type { SettingsState } from "@/views/settings/typeDefs";

export interface GlobalState {
  accessToken: string | undefined;
  refreshToken: string | undefined;
}

export interface WorkspaceState {
  configWizard: ConfigWizardState;
  executionResults: ExecutionResultsState;
  settings: SettingsState;
}

export const isGlobalState = (value: unknown): value is GlobalState => {
  return (
    typeof value === "object" &&
    value !== null &&
    "accessToken" in value &&
    "refreshToken" in value
  );
};

export const isWorkspaceState = (value: unknown): value is WorkspaceState => {
  return (
    typeof value === "object" &&
    value !== null &&
    "configWizard" in value &&
    "executionResults" in value &&
    "settings" in value
  );
};
