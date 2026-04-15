import { defineConfig } from "@vscode/test-cli";

export default defineConfig({
  files: "out/test/integration/**/*.test.js",
  workspaceFolder: "./src/test/integration/fixtures/workspace",
  mocha: {
    ui: "tdd",
    timeout: 20000,
    color: true,
  },
});
