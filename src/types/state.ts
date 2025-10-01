export interface GlobalState {
  accessToken: string | undefined;
  refreshToken: string | undefined;
  prismaticUrl: string | undefined;
}

export interface WorkspaceState {
  integrationId: string | undefined;
  systemInstanceId: string | undefined;
  flow:
    | {
        id: string;
        name: string;
        stableKey: string;
      }
    | undefined;
  debugMode: boolean | undefined;
  headers: Record<string, string> | undefined;
  payload: string | undefined;
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
    "example" in value
  );
};
