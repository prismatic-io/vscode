import type { Connection } from "./connections";
import type { Flow } from "./flows";

export interface GlobalState {
  accessToken: string | undefined;
  refreshToken: string | undefined;
  prismaticUrl: string | undefined;
}

export enum InstanceConfigState {
  FULLY_CONFIGURED = "FULLY_CONFIGURED",
  NEEDS_INSTANCE_CONFIGURATION = "NEEDS_INSTANCE_CONFIGURATION",
  NEEDS_USER_LEVEL_CONFIGURATION = "NEEDS_USER_LEVEL_CONFIGURATION",
}

export interface WorkspaceState {
  activeIntegrationPath: string | undefined;
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
  // Integration runtime data (fetched from API)
  configState: InstanceConfigState | undefined;
  flows: Flow[] | undefined;
  connections: Connection[] | undefined;
}

export const isGlobalState = (value: unknown): value is GlobalState => {
  return (
    typeof value === "object" &&
    value !== null &&
    "accessToken" in value &&
    "refreshToken" in value
  );
};

