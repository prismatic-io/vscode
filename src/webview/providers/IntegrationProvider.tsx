import { messageHandlerManager } from "@extension/MessageHandlerManager";
import { useActorRef, useSelector } from "@xstate/react";
import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from "react";
import type { Connection } from "@/types/connections";
import type { Flow } from "@/types/flows";
import { NoIntegration } from "@/webview/components/NoIntegration";
import { useVSCodeState } from "@/webview/hooks/useVSCodeState";
import { integrationMachine } from "@/webview/machines/integration/integration.machine";

const IntegrationContext = createContext<{
  flow: Flow | null;
  flows: Flow[];
  connections: Connection[];
  isLoading: boolean;
  refetch: () => void;
  systemInstanceId: string;
  configState: string | null;
  setFlow: (flowId: string) => void;
}>({
  flow: null,
  flows: [],
  connections: [],
  isLoading: false,
  refetch: () => {},
  systemInstanceId: "",
  configState: null,
  setFlow: () => {},
});

export const IntegrationProvider = ({ children }: { children: ReactNode }) => {
  const {
    state: workspaceState,
    updateState: updateWorkspaceState,
    hasLoaded: hasLoadedWorkspaceState,
  } = useVSCodeState({
    scope: "workspace",
  });

  const integrationActorRef = useActorRef(integrationMachine);

  // Read integration data from machine context
  const systemInstanceId = useSelector(
    integrationActorRef,
    (state) => state.context.systemInstanceId,
  );
  const flows = useSelector(
    integrationActorRef,
    (state) => state.context.flows,
  );
  const configState = useSelector(
    integrationActorRef,
    (state) => state.context.configState,
  );
  const connections = useSelector(
    integrationActorRef,
    (state) => state.context.connections,
  );
  const flow = useSelector(
    integrationActorRef,
    (state) => state.context.flow,
  );
  const isLoading = useSelector(integrationActorRef, (state) =>
    state.hasTag("loading"),
  );

  // Sync integration ID to machine
  useEffect(() => {
    if (workspaceState?.integrationId) {
      integrationActorRef.send({
        type: "SET_INTEGRATION_ID",
        integrationId: workspaceState.integrationId,
      });
    } else {
      integrationActorRef.send({ type: "CLEAR" });
    }
  }, [workspaceState?.integrationId, integrationActorRef]);

  // Sync workspace state data to machine
  useEffect(() => {
    integrationActorRef.send({
      type: "SYNC_DATA",
      data: {
        systemInstanceId: workspaceState?.systemInstanceId,
        configState: workspaceState?.configState,
        connections: workspaceState?.connections,
        flows: workspaceState?.flows,
      },
    });
  }, [
    workspaceState?.systemInstanceId,
    workspaceState?.configState,
    workspaceState?.connections,
    workspaceState?.flows,
    integrationActorRef,
  ]);

  const setFlow = useCallback(
    (flowId: string) => {
      const selectedFlow = flows.find((f) => f.id === flowId);

      if (!selectedFlow) {
        return;
      }

      // Update machine state
      integrationActorRef.send({ type: "SET_FLOW", flow: selectedFlow });

      // Propagate to workspace state (syncs to execution panel)
      updateWorkspaceState({ flow: selectedFlow });
    },
    [updateWorkspaceState, flows, integrationActorRef],
  );

  // Refetch triggers extension-level fetch via command
  const refetch = useCallback(() => {
    messageHandlerManager.postMessage({
      type: "integrationDetails.refresh",
      payload: new Date().toISOString(),
    });
  }, []);

  // Sync incoming workspace state flow changes to machine (e.g., from execution panel)
  useEffect(() => {
    if (workspaceState?.flow && workspaceState.flow.id !== flow?.id) {
      // Look up full flow object from flows array
      const fullFlow = flows.find((f) => f.id === workspaceState.flow?.id);
      if (fullFlow) {
        integrationActorRef.send({ type: "SET_FLOW", flow: fullFlow });
      }
    }
  }, [workspaceState?.flow, flow?.id, flows, integrationActorRef]);

  // Auto-select first flow if none selected or current flow no longer exists
  useEffect(() => {
    if (flows.length === 0) {
      return;
    }

    if (!flow || !flows.some((f) => f.id === flow.id)) {
      const firstFlow = flows[0];
      integrationActorRef.send({ type: "SET_FLOW", flow: firstFlow });
      updateWorkspaceState({ flow: firstFlow });
    }
  }, [flow, flows, updateWorkspaceState, integrationActorRef]);

  // Notify extension when flows are loaded for the Test Payloads tree view
  useEffect(() => {
    if (flows.length > 0) {
      messageHandlerManager.postMessage({
        type: "integrationDetails.flowsLoaded",
        payload: { flows },
      });
    }
  }, [flows]);

  const value = useMemo(
    () => ({
      systemInstanceId,
      configState,
      connections,
      flows,
      flow,
      refetch,
      isLoading,
      setFlow,
    }),
    [
      systemInstanceId,
      configState,
      connections,
      flows,
      flow,
      refetch,
      isLoading,
      setFlow,
    ],
  );

  if (hasLoadedWorkspaceState && !workspaceState?.integrationId) {
    return <NoIntegration />;
  }

  return (
    <IntegrationContext.Provider value={value}>
      {children}
    </IntegrationContext.Provider>
  );
};

export const useIntegrationContext = () => {
  const context = useContext(IntegrationContext);

  if (!context) {
    throw new Error(
      "useIntegrationContext must be used within IntegrationProvider",
    );
  }

  return context;
};
