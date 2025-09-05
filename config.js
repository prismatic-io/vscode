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
  },
  prismaticUrl: "https://app.prismatic.io",
};

module.exports = { CONFIG };
