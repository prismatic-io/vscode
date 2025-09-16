import { exec } from "node:child_process";
import { promisify } from "node:util";
import { findNpmExecutablePath } from "@/extension/lib/findNpmExecutablePath";
import { getWorkspaceJsonFile } from "@/extension/lib/getWorkspaceJsonFile";

type ExecError = Error & {
  stdout?: string;
  stderr?: string;
};

const execAsync = promisify(exec);

export const executeProjectNpmScript = async (
  scriptName: string,
): Promise<{ stdout: string; stderr: string }> => {
  const { workspaceFolderPath, fileData: packageFileData } =
    getWorkspaceJsonFile({
      fileName: "package.json",
    });

  if (!packageFileData) {
    throw new Error(
      `No package.json found in the workspace. Please ensure it exists in project directory.`,
    );
  }

  const npmExecutablePath = await findNpmExecutablePath();

  // 3. check if npm is installed and accessible
  if (!npmExecutablePath) {
    throw new Error(
      "npm is not found. Please ensure npm is installed and accessible. " +
        "You can install npm by running 'brew install node' (macOS) or visiting https://nodejs.org/",
    );
  }

  try {
    const { stdout, stderr } = await execAsync(
      `"${npmExecutablePath}" run ${scriptName}`,
      {
        cwd: workspaceFolderPath,
        env: {
          ...process.env,
          // explicitly override DEBUG to prevent Node's require from dumping debug data when CNI projects set DEBUG=true via dotenv
          DEBUG: "false",
        },
      },
    );

    return { stdout, stderr };
  } catch (error) {
    const execError = error as ExecError;
    const errorMessage = execError.message || String(error);
    const errorStdOut = (execError.stdout || "").replace(/^\n+/, "");

    if (
      errorMessage.includes("command not found") ||
      errorMessage.includes("ENOENT")
    ) {
      throw new Error(
        `Failed to execute npm script '${scriptName}': npm command not found. Please ensure npm is installed and accessible. You can install npm by running 'brew install node' (macOS) or visiting https://nodejs.org/`,
      );
    }

    throw new Error(
      `Failed to execute npm script '${scriptName}': ${errorMessage} \n ${errorStdOut}`,
    );
  }
};
