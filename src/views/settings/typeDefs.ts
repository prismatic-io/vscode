export interface SettingsState {
  dummy: string;
  debugMode: boolean;
  headers: Record<string, string>;
  payload: string;
}
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
