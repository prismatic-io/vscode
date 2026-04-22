import { readFile } from "node:fs/promises";
import * as esbuild from "esbuild";

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

const graphqlLoader: esbuild.Plugin = {
  name: "graphql-loader",
  setup(build) {
    build.onLoad({ filter: /\.graphql$/ }, async (args) => {
      const contents = await readFile(args.path, "utf-8");
      return {
        contents: `export default ${JSON.stringify(contents)};`,
        loader: "js",
      };
    });
  },
};

const extensionConfig: esbuild.BuildOptions = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "extension/extension.js",
  external: ["vscode"],
  platform: "node",
  target: "node20",
  format: "esm",
  sourcemap: !production,
  minify: production,
  logLevel: "info",
  plugins: [graphqlLoader],
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
