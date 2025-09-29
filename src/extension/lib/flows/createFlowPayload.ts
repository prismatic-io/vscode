import fs from "node:fs";
import path from "node:path";
import * as vscode from "vscode";
import { log } from "@/extension";
import {
  DEFAULT_PAYLOAD,
  FLOW_DIR,
  FLOW_PAYLOADS_DIR,
  SPECTRAL_DIR,
} from "@/extension/constants";
import { getWorkspacePath } from "@/extension/lib/getWorkspacePath";

/**
 * Create a new flow payload file
 * @param flowId - The flow ID to create the payload for
 * @returns {Promise<string | null>} The path to the created file or null if cancelled
 */
export const createFlowPayload = async (
  flowId: string,
): Promise<string | null> => {
  const workspacePath = getWorkspacePath();

  const payloadsDir = path.join(
    workspacePath,
    SPECTRAL_DIR,
    FLOW_DIR,
    flowId,
    FLOW_PAYLOADS_DIR,
  );

  if (!fs.existsSync(payloadsDir)) {
    fs.mkdirSync(payloadsDir, { recursive: true });
  }

  const payloadName = await vscode.window.showInputBox({
    prompt: "Enter payload name",
    placeHolder: "payload-name",
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return "Payload name is required";
      }

      if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
        return "Payload name can only contain letters, numbers, hyphens, and underscores";
      }

      return null;
    },
  });

  if (!payloadName) {
    return null;
  }

  const fileName = `${payloadName}.json`;
  const filePath = path.join(payloadsDir, fileName);

  if (fs.existsSync(filePath)) {
    const overwrite = await vscode.window.showWarningMessage(
      `Payload file "${fileName}" already exists. Do you want to overwrite it?`,
      "Yes",
      "No",
    );

    if (overwrite !== "Yes") {
      return null;
    }
  }

  try {
    fs.writeFileSync(filePath, JSON.stringify(DEFAULT_PAYLOAD, null, 2));

    log("SUCCESS", `Created payload file: ${fileName}`, true);

    const document = await vscode.workspace.openTextDocument(filePath);

    await vscode.window.showTextDocument(document);

    return filePath;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    log("ERROR", `Failed to create payload file: ${errorMessage}`, true);

    return null;
  }
};
