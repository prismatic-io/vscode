import {
  type ExecutablePath,
  findExecutable,
} from "@/extension/lib/findExecutable";
import { getConfiguredExecutablePath } from "@/extension/lib/getConfiguredExecutablePath";

export async function findPrismExecutable(): Promise<ExecutablePath | null> {
  const configuredPath = getConfiguredExecutablePath({
    configKey: "prismCliPath",
    logPrefix: "findPrismExecutable",
  });

  if (configuredPath) {
    return configuredPath;
  }

  // Use npx as the primary method for finding prism
  return findExecutable("prism", {
    npxPackage: "@prismatic-io/prism",
    logPrefix: "findPrismExecutable",
  });
}
