import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@/": `${path.resolve(import.meta.dirname, "src")}/`,
      "@type/": `${path.resolve(import.meta.dirname, "src/types")}/`,
      "@extension/": `${path.resolve(import.meta.dirname, "src/extension")}/`,
      "@webview/": `${path.resolve(import.meta.dirname, "src/webview")}/`,
    },
  },
  test: {
    globals: true,
    clearMocks: true,
    restoreMocks: true,
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["src/test/**/*", "node_modules"],
    environment: "node",
    environmentMatchGlobs: [
      ["src/webview/**/*.test.tsx", "jsdom"],
      ["src/shared/**/*.test.ts", "jsdom"],
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/types/**",
        "src/test/**",
        "src/**/index.tsx",
        "src/**/*.d.ts",
        "src/**/*.test.{ts,tsx}",
      ],
    },
  },
});
