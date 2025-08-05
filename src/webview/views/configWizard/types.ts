export interface ConfigWizardExampleMessage {
  type: "configWizard.example";
  payload: string;
}

export interface ConfigWizardErrorMessage {
  type: "configWizard.error";
  payload: {
    message: string;
    code?: number;
  };
}

export type ConfigWizardMessage =
  | ConfigWizardExampleMessage
  | ConfigWizardErrorMessage;
