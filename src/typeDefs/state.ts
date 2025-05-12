export interface ConfigWizardState {
  isComplete: boolean;
  lastConfig?: {
    success: boolean;
    message?: string;
  };
}

export interface ExecutionResultsState {
  lastExecution?: {
    timestamp: number;
    results: string;
  };
}

export interface PrismaticSettings {
  [key: string]: string | number | boolean;
}

export interface ExtensionState {
  configWizard: ConfigWizardState;
  executionResults: ExecutionResultsState;
  prismatic: {
    settings: PrismaticSettings;
  };
}
