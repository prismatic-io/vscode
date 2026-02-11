import fs from "node:fs";
import path from "node:path";
import { SPECTRAL_DIR } from "@/extension/constants";

export interface FindSpectralDirectoriesOptions {
  maxDepth?: number;
}

/**
 * Recursively find all .spectral directories within a root path
 */
export function findSpectralDirectories(
  rootPath: string,
  options: FindSpectralDirectoriesOptions = {},
): string[] {
  const { maxDepth = 5 } = options;
  const results: string[] = [];
  searchForSpectral(rootPath, results, 0, maxDepth);
  return results;
}

/**
 * Recursive helper to search for .spectral directories
 */
function searchForSpectral(
  currentPath: string,
  results: string[],
  currentDepth: number,
  maxDepth: number,
): void {
  if (currentDepth > maxDepth) return;

  try {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      // Skip common directories that won't contain integrations
      if (
        entry.name === "node_modules" ||
        entry.name === "dist" ||
        entry.name === ".git" ||
        entry.name === ".vscode"
      ) {
        continue;
      }

      const fullPath = path.join(currentPath, entry.name);

      if (entry.name === SPECTRAL_DIR) {
        results.push(fullPath);
        // Don't recurse into .spectral directories
      } else {
        // Recurse into subdirectories
        searchForSpectral(fullPath, results, currentDepth + 1, maxDepth);
      }
    }
  } catch {
    // Ignore permission errors or other access issues
  }
}
