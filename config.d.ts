export interface WebviewConfig {
  entryPoint: string;
  outdir: string;
  scriptPath: string;
  viewType: string;
  title: string;
  command: string;
}

interface Config {
  webviews: Record<string, WebviewConfig>;
}

declare const CONFIG: Config;
export { CONFIG };
