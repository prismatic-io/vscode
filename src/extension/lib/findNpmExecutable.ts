import {
  type ExecutablePath,
  findExecutable,
} from "@/extension/lib/findExecutable";
import { getConfiguredExecutablePath } from "@/extension/lib/getConfiguredExecutablePath";

export async function findNpmExecutable(): Promise<ExecutablePath | null> {
  const configuredPath = getConfiguredExecutablePath({
    configKey: "npmCliPath",
    logPrefix: "findNpmExecutable",
  });

  if (configuredPath) {
    return configuredPath;
  }

  return findExecutable("npm", {
    npxPackage: "npm",
    logPrefix: "findNpmExecutable",
  });
}
