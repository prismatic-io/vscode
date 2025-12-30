import fs, { existsSync } from "node:fs";
import path from "node:path";
import { getActiveIntegrationPath } from "@/extension/lib/getActiveIntegrationPath";

interface GetWorkspaceJsonFileProps {
  workspaceFolderPath?: string;
  directory?: string;
  fileName: string;
}

export const getWorkspaceJsonFile = <T = Record<string, unknown>>({
  workspaceFolderPath,
  directory = "",
  fileName,
}: GetWorkspaceJsonFileProps): {
  workspaceFolderPath: string;
  filePath: string;
  fileData: T | null;
} => {
  // Use provided path or fall back to active integration path
  const resolvedPath = workspaceFolderPath ?? getActiveIntegrationPath();

  if (!resolvedPath) {
    throw new Error("No workspace folder found.");
  }

  try {
    const filePath = path.join(resolvedPath, directory, fileName);

    if (!existsSync(filePath)) {
      return {
        workspaceFolderPath: resolvedPath,
        filePath,
        fileData: null,
      };
    }

    const file = fs.readFileSync(filePath, "utf8");
    const fileData = JSON.parse(file) as T;

    return {
      workspaceFolderPath: resolvedPath,
      filePath,
      fileData,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    throw new Error(
      `Failed to read or parse ${fileName} in ${directory}: ${errorMessage}`,
    );
  }
};
