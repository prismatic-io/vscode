import { findExecutablePath } from "./findExecutablePath";

export async function findNpmExecutablePath(): Promise<string | null> {
  return findExecutablePath("npm", {
    npxFallback: "npm",
    logPrefix: "findNpmExecutablePath",
  });
}
