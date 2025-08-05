export interface SettingsExampleMessage {
  type: "settings.example";
  payload: string;
}

export interface SettingsErrorMessage {
  type: "settings.error";
  payload: {
    message: string;
    code?: number;
  };
}

export type SettingsMessage = SettingsExampleMessage | SettingsErrorMessage;
