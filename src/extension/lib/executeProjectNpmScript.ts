import { getActiveIntegrationPath } from "@/extension/lib/getActiveIntegrationPath";
import { getWorkspaceJsonFile } from "@/extension/lib/getWorkspaceJsonFile";
import { resolveNpmExecutable } from "@/extension/lib/resolveExecutable";
import { runExecutable } from "@/extension/lib/runCommand";

export const executeProjectNpmScript = async (
  scriptName: string,
): Promise<{ stdout: string; stderr: string }> => {
  const integrationPath = getActiveIntegrationPath();

  const { workspaceFolderPath, fileData: packageFileData } =
    getWorkspaceJsonFile({
      workspaceFolderPath: integrationPath,
      fileName: "package.json",
    });

  if (!packageFileData) {
    throw new Error(
      `No package.json found in the active integration. Please ensure it exists in: ${integrationPath}`,
    );
  }

  const npmExecutable = await resolveNpmExecutable();

  if (!npmExecutable) {
    throw new Error(
      "npm is not found. Please ensure npm is installed and accessible. " +
        "You can install npm by running 'brew install node' (macOS) or visiting https://nodejs.org/",
    );
  }

  // Exclude DEBUG to prevent debug noise from CNI projects
  const { DEBUG: _, ...execEnv } = process.env;

  try {
    return await runExecutable(npmExecutable, ["run", scriptName], {
      cwd: workspaceFolderPath,
      env: execEnv,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const execError = error as { stdout?: string; stderr?: string };
    const errorStdout = (execError.stdout || "").trim();
    const errorStderr = (execError.stderr || "").trim();

    const details = [
      `Failed to execute npm script '${scriptName}'`,
      errorMessage,
      errorStdout && `stdout: ${errorStdout}`,
      errorStderr && `stderr: ${errorStderr}`,
    ]
      .filter(Boolean)
      .join("\n");

    throw new Error(details);
  }
};
