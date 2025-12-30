import { MessageHandlerManager } from "@extension/MessageHandlerManager";
import { useActorRef, useSelector } from "@xstate/react";
import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from "react";

const messageHandlerManager = new MessageHandlerManager();
import type { Flow } from "@/types/flows";
import { NoIntegration } from "@/webview/components/NoIntegration";
import { useVSCodeState } from "@/webview/hooks/useVSCodeState";
import { useWebviewMessage } from "@/webview/hooks/useWebviewMessage";
import type { Connection } from "@/webview/machines/integration/getIntegration";
import { integrationMachine } from "@/webview/machines/integration/integration.machine";
import { useAuthContext } from "@/webview/providers/AuthProvider";

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
  const { accessToken, prismaticUrl } = useAuthContext();

  const integrationMachineActorRef = useActorRef(integrationMachine, {
    input: { accessToken, prismaticUrl },
  });

  const {
    state: workspaceState,
    updateState: updateWorkspaceState,
    hasLoaded: hasLoadedWorkspaceState,
  } = useVSCodeState({
    scope: "workspace",
  });

  const systemInstanceId = useSelector(
    integrationMachineActorRef,
    (state) => state.context.systemInstanceId,
  );

  const flows = useSelector(
    integrationMachineActorRef,
    (state) => state.context.flows,
  );

  const configState = useSelector(
    integrationMachineActorRef,
    (state) => state.context.configState,
  );

  const connections = useSelector(
    integrationMachineActorRef,
    (state) => state.context.connections,
  );

  const setFlow = useCallback(
    (flowId: string) => {
      const flow = flows.find((f) => f.id === flowId);

      if (!flow) {
        return;
      }

      updateWorkspaceState({ flow });
    },
    [updateWorkspaceState, flows],
  );

  const refetch = useCallback(() => {
    integrationMachineActorRef.send({ type: "FETCH" });
  }, [integrationMachineActorRef]);

  const isLoading = useSelector(integrationMachineActorRef, (state) =>
    state.hasTag("loading"),
  );

  // Listen for refresh message from extension header button
  const { message: refreshMessage } = useWebviewMessage(
    "integrationDetails.refresh",
  );

  useEffect(() => {
    if (refreshMessage) {
      refetch();
    }
  }, [refreshMessage, refetch]);

  useEffect(() => {
    if (workspaceState?.integrationId) {
      integrationMachineActorRef.send({
        type: "SET_INTEGRATION_ID",
        integrationId: workspaceState.integrationId,
      });
    }
  }, [workspaceState?.integrationId, integrationMachineActorRef]);

  useEffect(() => {
    if (flows.length === 0) {
      return;
    }

    if (
      !workspaceState?.flow ||
      !flows.some((flow) => flow.id === workspaceState.flow?.id)
    ) {
      updateWorkspaceState({ flow: flows[0] });
    }
  }, [workspaceState?.flow, flows, updateWorkspaceState]);

  // Notify extension when flows are loaded for the Test Payloads tree view
  useEffect(() => {
    if (flows.length > 0) {
      messageHandlerManager.postMessage({
        type: "integrationDetails.flowsLoaded",
        payload: { flows },
      });
    }
  }, [flows]);

  // Look up the full flow object from flows array based on stored flow id
  const currentFlow = useMemo(() => {
    if (!workspaceState?.flow?.id) {
      return null;
    }
    return flows.find((f) => f.id === workspaceState.flow?.id) ?? null;
  }, [workspaceState?.flow?.id, flows]);

  const value = useMemo(
    () => ({
      systemInstanceId,
      configState,
      connections,
      flows,
      flow: currentFlow,
      refetch,
      isLoading,
      setFlow,
    }),
    [
      systemInstanceId,
      configState,
      connections,
      flows,
      currentFlow,
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
