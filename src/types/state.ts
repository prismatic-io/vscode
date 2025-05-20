import type { ConfigWizardState } from "@webview/views/configWizard/types";
import type { ExecutionResultsState } from "@webview/views/executionResults/types";
import type { SettingsState } from "@webview/views/settings/types";

export interface GlobalState {
  accessToken: string | undefined;
  refreshToken: string | undefined;
  prismaticUrl: string | undefined;
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
