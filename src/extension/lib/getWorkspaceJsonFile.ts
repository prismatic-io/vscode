import fs, { existsSync } from "node:fs";
import path from "node:path";
import { getWorkspacePath } from "@/extension/lib/getWorkspacePath";

interface GetWorkspaceJsonFileProps {
  workspaceFolderPath?: string;
  directory?: string;
  fileName: string;
}

export const getWorkspaceJsonFile = <T = Record<string, unknown>>({
  workspaceFolderPath = getWorkspacePath(),
  directory = "",
  fileName,
}: GetWorkspaceJsonFileProps): {
  workspaceFolderPath: string;
  filePath: string;
  fileData: T | null;
} => {
  if (!workspaceFolderPath) {
    throw new Error("No workspace folder found.");
  }

  try {
    const filePath = path.join(workspaceFolderPath, directory, fileName);

    if (!existsSync(filePath)) {
      return {
        workspaceFolderPath,
        filePath,
        fileData: null,
      };
    }

    const file = fs.readFileSync(filePath, "utf8");
    const fileData = JSON.parse(file) as T;

    return {
      workspaceFolderPath,
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
