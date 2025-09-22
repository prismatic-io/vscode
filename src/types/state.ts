// Flow data structure matching API response
export interface FlowData {
  id: string;
  name: string;
  stableKey: string;
  isSynchronous?: boolean;
  description?: string;
  usesFifoQueue?: boolean;
  schemas?: any;
  testUrl?: string;
  testPayload?: string;
}

// Config page element structure
export interface ConfigPageElement {
  type: string;
  value: string;
}

// Config page structure
export interface ConfigPageData {
  name: string;
  elements: ConfigPageElement[];
}

// Complete integration data structure matching API response
export interface IntegrationData {
  id: string;
  name: string;
  description?: string;
  versionNumber?: string;
  category?: string;
  labels?: string[];
  configPages?: ConfigPageData[];
  systemInstance?: {
    id: string;
    configState: string;
    flowConfigs: {
      nodes: Array<{
        flow: FlowData;
      }>;
    };
  };
}

export interface GlobalState {
  accessToken: string | undefined;
  refreshToken: string | undefined;
  prismaticUrl: string | undefined;
}

export interface WorkspaceState {
  integrationId: string | undefined;
  systemInstanceId: string | undefined;
  flowId: string | undefined;
  debugMode: boolean | undefined;
  headers: Record<string, string> | undefined;
  payload: string | undefined;
  integration: IntegrationData | undefined;
  // Multi-integration support
  activeIntegrationPath: string | undefined;
  discoveredIntegrations: Record<string, {
    integrationId?: string;
    lastSeen: number;
  }> | undefined;
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
