export interface WebviewConfig {
  command: string;
  scriptPath: string;
  title: string;
  viewType: string;
}

export const CONFIG = {
  webviews: {
    executionResults: {
      command: "prismatic.executionResults",
      scriptPath: "dist/executionResultsView/index.js",
      title: "Execution Results",
      viewType: "executionResults.webview",
    },
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
