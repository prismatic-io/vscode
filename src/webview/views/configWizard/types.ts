export interface ConfigWizardCloseMessage {
  type: "configWizard.closed";
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
  | ConfigWizardCloseMessage
  | ConfigWizardErrorMessage;

export interface ConfigWizardContextValue {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  iframeUrl: string;
  hasLoaded: boolean;
}
