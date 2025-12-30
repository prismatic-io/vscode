import { StateManager } from "@extension/StateManager";

/**
 * Gets the active integration path from workspace state.
 * @returns The active integration path
 * @throws Error if no active integration is selected
 */
export const getActiveIntegrationPath = (): string => {
  const stateManager = StateManager.getInstance();
  const workspaceState = stateManager.getWorkspaceStateSync();

  if (!workspaceState?.activeIntegrationPath) {
    throw new Error(
      "No active integration selected. Please select an integration from the sidebar.",
    );
  }

  return workspaceState.activeIntegrationPath;
};
