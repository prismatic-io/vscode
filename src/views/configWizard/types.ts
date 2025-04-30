export interface ConfigWizardDummyMessage {
  type: "configWizard.dummy";
  payload: string;
}

export interface ConfigWizardErrorMessage {
  type: "configWizard.error";
  payload: {
    message: string;
    code?: number;
  };
}

export interface ConfigWizardCompleteMessage {
  type: "configWizard.complete";
  payload: {
    success: boolean;
    message?: string;
  };
}

export type ConfigWizardMessage =
  | ConfigWizardDummyMessage
  | ConfigWizardErrorMessage
  | ConfigWizardCompleteMessage;
