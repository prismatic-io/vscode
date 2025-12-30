const CONFIG = {
  webviews: {
    executionResults: {
      command: "prismatic.executionResults",
      entryPoint: "src/webview/views/executionResults/index.tsx",
      outdir: "dist/executionResultsView",
      scriptPath: "dist/executionResultsView/index.js",
      title: "Execution Results",
      viewType: "executionResults.webview",
    },
    configWizard: {
      command: "prismatic.configWizard",
      entryPoint: "src/webview/views/configWizard/index.tsx",
      outdir: "dist/configWizardView",
      scriptPath: "dist/configWizardView/index.js",
      title: "Config Wizard",
      viewType: "configWizard.webview",
    },
    integrationDetails: {
      command: "prismatic.integrationDetails",
      entryPoint: "src/webview/views/integrationDetails/index.tsx",
      outdir: "dist/integrationDetailsView",
      scriptPath: "dist/integrationDetailsView/index.js",
      title: "Integration Details",
      viewType: "integrationDetails.webview",
    },
  },
  prismaticUrl: "https://app.prismatic.io",
};

module.exports = { CONFIG };
