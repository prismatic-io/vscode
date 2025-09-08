import { findExecutablePath } from "./findExecutablePath";

export async function findNpmPath(): Promise<string | null> {
  return findExecutablePath("npm", {
    npxFallback: "npm",
    logPrefix: "findNpmPath",
  });
}
