import { findExecutablePath } from "./findExecutablePath";

export async function findPrismExecutablePath(): Promise<string | null> {
  return findExecutablePath("prism", {
    npxFallback: "@prismatic-io/prism",
    logPrefix: "findPrismExecutablePath",
  });
}
