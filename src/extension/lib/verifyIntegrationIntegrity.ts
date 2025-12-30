import { createActor, toPromise } from "xstate";
import { log } from "@/extension";
import { getWorkspaceJsonFile } from "@/extension/lib/getWorkspaceJsonFile";
import { getIntegration } from "@/extension/machines/integrationsFlowsTest/getIntegration";
import { StateManager } from "@/extension/StateManager";
import { SPECTRAL_DIR } from "../constants";

/**
 * Verifies that the current integration ID exists and is accessible in Prismatic.
 * If the integration is not found, clears the workspace state.
 */
export const verifyIntegrationIntegrity = async (): Promise<void> => {
  const integrationId = await syncIntegrationId();
  const stateManager = StateManager.getInstance();
  const globalState = await stateManager.getGlobalState();

  // if authentication is not configured, skip verification
  if (!globalState?.accessToken || !globalState?.prismaticUrl) {
    return;
  }

  // if integration ID is not found, skip verification
  if (!integrationId) {
    return;
  }

  try {
    const dataActor = createActor(getIntegration, {
      input: {
        integrationId,
        accessToken: globalState?.accessToken,
        prismaticUrl: globalState?.prismaticUrl,
      },
    });

    dataActor.start();

    await toPromise(dataActor);
  } catch (_error) {
    log(
      "WARN",
      `No integration found for ID (${integrationId}) in ${globalState?.prismaticUrl}, clearing workspace state...`,
    );

    await stateManager.updateWorkspaceState({
      integrationId: undefined,
      flow: undefined,
    });
  }
};

/**
 * Synchronizes the integration ID between workspace state and the SPECTRAL_DIR/prism.json file.
 * Uses the active integration path from workspace state.
 * @returns Promise that resolves to the current integration ID, or undefined if none found
 */
export const syncIntegrationId = async (): Promise<string | undefined> => {
  const stateManager = StateManager.getInstance();
  const workspaceState = await stateManager.getWorkspaceState();

  // If no active integration is selected, return existing integrationId
  if (!workspaceState?.activeIntegrationPath) {
    return workspaceState?.integrationId;
  }

  // Check if integrationId is in SPECTRAL_DIR/prism.json file
  let fileData: Record<string, unknown> | null = null;
  try {
    const result = getWorkspaceJsonFile({
      directory: SPECTRAL_DIR,
      fileName: "prism.json",
    });
    fileData = result.fileData;
  } catch {
    // No active integration path set yet
    return workspaceState?.integrationId;
  }

  if (fileData && "integrationId" in fileData && fileData.integrationId) {
    const fileIntegrationId = fileData.integrationId as string;

    // check if in sync
    if (workspaceState?.integrationId === fileIntegrationId) {
      return fileIntegrationId;
    }

    log(
      "INFO",
      `Integration ID is out of sync, updating workspace state...
    - Workspace: ${workspaceState?.integrationId}
    - File: ${fileData.integrationId} (new)
    `,
    );

    // if not in sync, update workspace state
    await stateManager.updateWorkspaceState({
      integrationId: fileIntegrationId,
    });

    return fileIntegrationId;
  }

  return workspaceState?.integrationId;
};
