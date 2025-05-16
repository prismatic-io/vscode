export interface SettingsState {
  integrationId: string | undefined;
  dummy: string | undefined;
  debugMode: boolean | undefined;
  headers: Record<string, string> | undefined;
  payload: string | undefined;
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
