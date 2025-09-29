import * as vscode from "vscode";
import { log } from "@/extension";
import {
  FLOW_DIR,
  FLOW_PAYLOADS_DIR,
  SPECTRAL_DIR,
} from "@/extension/constants";
import { getProjectFlowPayloads } from "@/extension/lib/flows/getProjectFlowPayloads";
import { getWorkspaceJsonFile } from "@/extension/lib/getWorkspaceJsonFile";
import type { FlowPayload } from "@/types/flows";

/**
 * Select a Flow payload from the project
 * @param flowId - The flow ID to get the payload for
 * @returns {Promise<FlowPayload | null>} The Flow payload
 */
export const selectProjectFlowPayload = async (
  flowId?: string,
): Promise<FlowPayload | null> => {
  if (!flowId) {
    return null;
  }

  const flowPayloads = await getProjectFlowPayloads(flowId);

  if (flowPayloads.length === 0) {
    return null;
  }

  const selectedFlowPayload = await vscode.window.showQuickPick(
    [
      ...flowPayloads.map((payload) => ({
        label: payload.fileName,
        payload,
      })),
      {
        label: "No Payload",
        payload: null,
      },
    ],
    {
      placeHolder: "Select a payload file to use for testing",
      title: "Select Flow Payload",
    },
  );

  if (!selectedFlowPayload?.payload) {
    return null;
  }

  log(
    "INFO",
    `Selected payload: ${selectedFlowPayload?.payload?.fileName || "No Payload"}`,
  );

  return getWorkspaceJsonFile<FlowPayload>({
    directory: `${SPECTRAL_DIR}/${FLOW_DIR}/${flowId}/${FLOW_PAYLOADS_DIR}`,
    fileName: selectedFlowPayload.payload.fileName,
  }).fileData;
};
