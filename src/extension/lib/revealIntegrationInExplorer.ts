import * as vscode from "vscode";

/**
 * Reveal an integration folder in the VS Code Explorer and expand it.
 *
 * The built-in `revealInExplorer` only selects the folder row; `list.expand`
 * then expands the focused row so the user sees the folder's contents.
 */
export const revealIntegrationInExplorer = async (
  integrationPath: string,
): Promise<void> => {
  const uri = vscode.Uri.file(integrationPath);
  await vscode.commands.executeCommand("revealInExplorer", uri);
  await vscode.commands.executeCommand("list.expand");
};
