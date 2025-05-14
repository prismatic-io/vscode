const CONFIG = {
  webviews: {
    settings: {
      command: "prismatic.settings",
      entryPoint: "src/views/settings/index.tsx",
      outdir: "dist/settingsView",
      scriptPath: "dist/settingsView/index.js",
      title: "Settings",
      viewType: "settings.webview",
    },
    executionResults: {
      command: "prismatic.executionResults",
      entryPoint: "src/views/executionResults/index.tsx",
      outdir: "dist/executionResultsView",
      scriptPath: "dist/executionResultsView/index.js",
      title: "Execution Results",
      viewType: "executionResults.webview",
    },
    configWizard: {
      command: "prismatic.configWizard",
      entryPoint: "src/views/configWizard/index.tsx",
      outdir: "dist/configWizardView",
      scriptPath: "dist/configWizardView/index.js",
      title: "Configuration Wizard",
      viewType: "configWizard.webview",
    },
  },
};

module.exports = { CONFIG };
