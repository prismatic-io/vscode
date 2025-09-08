import { findExecutablePath } from "./findExecutablePath";

export async function findPrismPath(): Promise<string | null> {
  return findExecutablePath("prism", {
    npxFallback: "@prismatic-io/prism",
    logPrefix: "findPrismPath",
  });
}
