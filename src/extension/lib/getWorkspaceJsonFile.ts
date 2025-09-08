import fs, { existsSync } from "node:fs";
import path from "node:path";
import { getWorkspacePath } from "@/extension/getWorkspacePath";

interface GetWorkspaceJsonFileProps {
  workspaceFolderPath?: string;
  directory?: string;
  fileName: string;
}

export const getWorkspaceJsonFile = ({
  workspaceFolderPath = getWorkspacePath(),
  directory = "",
  fileName,
}: GetWorkspaceJsonFileProps) => {
  if (!workspaceFolderPath) {
    throw new Error("No workspace folder found.");
  }

  try {
    const filePath = path.join(workspaceFolderPath, directory, fileName);

    if (!existsSync(filePath)) {
      throw new Error();
    }

    const file = fs.readFileSync(filePath, "utf8");
    const fileData = JSON.parse(file) as Record<string, unknown>;

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
