const esbuild = require("esbuild");
const path = require("node:path");
const fs = require("node:fs");
const { CONFIG } = require("./config.js");

const isProduction = process.env.NODE_ENV === "production";
const isWatch = process.argv.includes("--watch");

// Clean output directories
const cleanOutputDirs = () => {
  const dirs = ["extension", "dist"];

  for (const dir of dirs) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
};

// Custom plugin for error handling
const errorPlugin = {
  name: "error-handler",
  setup(build) {
    const mode = isProduction ? "Prod" : "Dev";
    const watch = isWatch ? "Watch" : "Build";

    build.onStart(() => {
      console.log(`[${mode}] ${watch} started`);
    });

    build.onEnd((result) => {
      if (result.errors.length > 0) {
        console.error("Failed with errors:");

        for (const error of result.errors) {
          console.error(error);
        }
        process.exit(1);
      }
      console.log(`[${mode}] ${watch} finished`);
    });
  },
};

// Extension build options
const extensionBuildOptions = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "extension/extension.js",
  external: ["vscode"],
  platform: "node",
  target: "node16",
  format: "cjs",
  sourcemap: !isProduction,
  minify: isProduction,
  define: {
    "process.env.NODE_ENV": isProduction ? '"production"' : '"development"',
  },
  treeShaking: true,
  legalComments: "none",
};

// Common webview build options
const webviewBuildOptions = {
  bundle: true,
  platform: "browser",
  target: ["es2020"],
  format: "iife",
  sourcemap: !isProduction,
  minify: isProduction,
  define: {
    "process.env.NODE_ENV": isProduction ? '"production"' : '"development"',
  },
  loader: {
    ".js": "jsx",
    ".jsx": "jsx",
    ".ts": "tsx",
    ".tsx": "tsx",
    ".css": "css",
  },
  jsx: "automatic",
  jsxDev: !isProduction,
  jsxFactory: "React.createElement",
  jsxFragment: "React.Fragment",
  treeShaking: true,
  legalComments: "none",
};

const build = async () => {
  try {
    // Clean output directories before building
    if (!isWatch) {
      cleanOutputDirs();
    }

    // Get build options for each webview
    const webviewBuilds = Object.entries(CONFIG.webviews).map(
      ([_, config]) => ({
        ...webviewBuildOptions,
        entryPoints: [config.entryPoint],
        outfile: path.join(config.outdir, "index.js"),
        plugins: [errorPlugin],
      })
    );

    if (isWatch) {
      const extensionContext = await esbuild.context({
        ...extensionBuildOptions,
        plugins: [errorPlugin],
      });

      const webviewContexts = await Promise.all(
        webviewBuilds.map((options) => esbuild.context(options))
      );

      await Promise.all([
        extensionContext.watch(),
        ...webviewContexts.map((context) => context.watch()),
      ]);
    } else {
      await Promise.all([
        esbuild.build({
          ...extensionBuildOptions,
          plugins: [errorPlugin],
        }),
        ...webviewBuilds.map((options) => esbuild.build(options)),
      ]);
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

build();
