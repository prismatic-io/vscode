import { readFile } from "node:fs/promises";
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@/": `${path.resolve(import.meta.dirname, "src")}/`,
      "@type/": `${path.resolve(import.meta.dirname, "src/types")}/`,
      "@extension/": `${path.resolve(import.meta.dirname, "src/extension")}/`,
      "@webview/": `${path.resolve(import.meta.dirname, "src/webview")}/`,
    },
  },
  plugins: [
    {
      name: "graphql-loader",
      async transform(_src, id) {
        if (!id.endsWith(".graphql")) return null;
        const contents = await readFile(id, "utf-8");
        return {
          code: `export default ${JSON.stringify(contents)};`,
          map: null,
        };
      },
    },
  ],
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
    setupFiles: ["src/test/unit/setup.ts"],
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
