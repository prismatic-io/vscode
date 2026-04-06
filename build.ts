import * as esbuild from "esbuild";

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

const extensionConfig: esbuild.BuildOptions = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "extension/extension.js",
  external: ["vscode"],
  platform: "node",
  target: "node16",
  format: "cjs",
  sourcemap: !production,
  minify: production,
  logLevel: "info",
};

const webviewBaseConfig: esbuild.BuildOptions = {
  bundle: true,
  platform: "browser",
  target: "es2020",
  format: "iife",
  sourcemap: !production,
  minify: production,
  loader: { ".css": "css" },
  jsx: "automatic",
  jsxDev: !production,
  logLevel: "info",
};

const webviews = [
  { entry: "src/webview/views/executionResults/index.tsx", outdir: "dist/executionResultsView" },
  { entry: "src/webview/views/configWizard/index.tsx", outdir: "dist/configWizardView" },
  { entry: "src/webview/views/integrationDetails/index.tsx", outdir: "dist/integrationDetailsView" },
];

async function main() {
  const configs: esbuild.BuildOptions[] = [
    extensionConfig,
    ...webviews.map((wv) => ({
      ...webviewBaseConfig,
      entryPoints: [wv.entry],
      outfile: `${wv.outdir}/index.js`,
    })),
  ];

  if (watch) {
    const contexts = await Promise.all(
      configs.map((config) => esbuild.context(config))
    );
    await Promise.all(contexts.map((ctx) => ctx.watch()));
  } else {
    await Promise.all(configs.map((config) => esbuild.build(config)));
  }
}

main().catch(() => process.exit(1));
