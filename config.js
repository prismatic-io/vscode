const CONFIG = {
  webviews: {
    example: {
      command: "prismatic.example",
      entryPoint: "src/webview/views/_example/index.tsx",
      outdir: "dist/exampleView",
      scriptPath: "dist/exampleView/index.js",
      title: "Example",
      viewType: "example.webview",
    },
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
      title: "Configuration Wizard",
      viewType: "configWizard.webview",
    },
  },
  prismaticUrl: "https://app.dev.prismatic-dev.io",
};

module.exports = { CONFIG };
