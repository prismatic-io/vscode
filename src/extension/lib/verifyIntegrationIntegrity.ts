import { createActor, toPromise } from "xstate";
import { log } from "@/extension";
import { getWorkspaceJsonFile } from "@/extension/lib/getWorkspaceJsonFile";
import { getIntegration } from "@/extension/machines/integrationsFlowsTest/getIntegration";
import { StateManager } from "@/extension/StateManager";
import { IntegrationDiscovery } from "@/extension/lib/IntegrationDiscovery";
import * as path from "path";

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
      flowId: undefined,
    });
  }
};

/**
 * Synchronizes the integration ID between workspace state and the .spectral/prism.json file.
 * Now supports multi-integration workspaces by checking the active integration.
 * @returns Promise that resolves to the current integration ID, or undefined if none found
 */
export const syncIntegrationId = async (): Promise<string | undefined> => {
  // step 1. check if integrationId is already in workspace state
  const stateManager = StateManager.getInstance();
  const workspaceState = await stateManager.getWorkspaceState();

  // step 2. get the active integration
  const activeIntegration = await IntegrationDiscovery.getActiveIntegration();

  if (!activeIntegration) {
    // No active integration, return workspace state ID
    return workspaceState?.integrationId;
  }

  // step 3. check if integrationId is in the active integration's .spectral/prism.json file
  const prismJsonPath = activeIntegration.hasPrismJson
    ? path.join(activeIntegration.spectralPath, "prism.json")
    : null;

  if (!prismJsonPath) {
    // No prism.json file in active integration
    return workspaceState?.integrationId;
  }

  // Read the prism.json file from the active integration
  const { fileData } = getWorkspaceJsonFile({
    workspaceFolderPath: activeIntegration.path,
    directory: ".spectral",
    fileName: "prism.json",
  });

  if (fileData && "integrationId" in fileData && fileData.integrationId) {
    const fileIntegrationId = fileData.integrationId as string;

    // check if in sync
    if (workspaceState?.integrationId === fileIntegrationId) {
      return fileIntegrationId;
    }

    log(
      "INFO",
      `Integration ID is out of sync for ${activeIntegration.name}, updating workspace state...
    - Workspace: ${workspaceState?.integrationId}
    - File: ${fileData.integrationId} (new)
    `,
    );

    // if not in sync, update workspace state
    await stateManager.updateWorkspaceState({
      integrationId: fileIntegrationId,
      activeIntegrationPath: activeIntegration.path,
    });

    return fileIntegrationId;
  }

  return workspaceState?.integrationId;
};
