import { createActor, toPromise } from "xstate";
import { log } from "@/extension";
import { getWorkspaceJsonFile } from "@/extension/getWorkspaceJsonFile";
import { StateManager } from "@/extension/StateManager";
import { getIntegration } from "@/lib/integrationsFlowsTest/getIntegration";

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
  } catch (error) {
    log("WARN", `No integration found for ID (${integrationId}) in ${globalState?.prismaticUrl}, clearing workspace state...`);

    await stateManager.updateWorkspaceState({
      integrationId: undefined,
    });
  }
};

/**
 * Synchronizes the integration ID between workspace state and the .spectral/prism.json file.
 * @returns Promise that resolves to the current integration ID, or undefined if none found
 */
export const syncIntegrationId = async (): Promise<string | undefined> => {
  // step 1. check if integrationId is already in workspace state
  const stateManager = StateManager.getInstance();
  const workspaceState = await stateManager.getWorkspaceState();

  // step 2. check if integrationId is in .spectral/prism.json file
  const { fileData } = getWorkspaceJsonFile({
    directory: ".spectral",
    fileName: "prism.json",
  });

  if ("integrationId" in fileData && fileData.integrationId) {
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
