const path = require("node:path");

const CONFIG = {
  webviews: {
    prismatic: {
      command: "prismatic.settings",
      entryPoint: "src/views/prismatic/index.tsx",
      outdir: "dist/prismaticView",
      scriptPath: "dist/prismaticView/index.js",
      title: "Prismatic",
      viewType: "prismatic.webview",
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
  // Add other configuration sections here
  // build: { ... },
  // paths: { ... },
  // etc.
};

module.exports = { CONFIG };
