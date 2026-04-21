export interface WebviewConfig {
  command: string;
  scriptPath: string;
  title: string;
  viewType: string;
}

export const CONFIG = {
  webviews: {
    configWizard: {
      command: "prismatic.configWizard",
      scriptPath: "dist/configWizardView/index.js",
      title: "Config Wizard",
      viewType: "configWizard.webview",
    },
    integrationDetails: {
      command: "prismatic.integrationDetails",
      scriptPath: "dist/integrationDetailsView/index.js",
      title: "Development Instance",
      viewType: "integrationDetails.webview",
    },
  },
  prismaticUrl: "https://app.prismatic.io",
} as const;
