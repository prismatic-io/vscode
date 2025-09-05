import { useActorRef, useSelector } from "@xstate/react";
import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from "react";
import { NoIntegration } from "@/webview/components/NoIntegration";
import { useVSCodeState } from "@/webview/hooks/useVSCodeState";
import {
  type IntegrationFlow,
  integrationMachine,
} from "@/webview/machines/integration/integration.machine";
import { useAuthContext } from "@/webview/providers/AuthProvider";

const IntegrationContext = createContext<{
  flowId: string;
  flows: IntegrationFlow[];
  isLoading: boolean;
  refetch: () => void;
  systemInstanceId: string;
  setFlowId: (flowId: string) => void;
}>({
  flowId: "",
  flows: [],
  isLoading: false,
  refetch: () => { },
  systemInstanceId: "",
  setFlowId: () => { },
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

  const setFlowId = useCallback(
    (flowId: string) => {
      updateWorkspaceState({ flowId });
    },
    [updateWorkspaceState],
  );

  const refetch = useCallback(() => {
    integrationMachineActorRef.send({ type: "FETCH" });
  }, [integrationMachineActorRef]);

  const isLoading = useSelector(integrationMachineActorRef, (state) =>
    state.hasTag("loading"),
  );

  console.log({ integrationMachineActorRef, isLoading });

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
      !workspaceState?.flowId ||
      !flows.some((flow) => flow.id === workspaceState?.flowId)
    ) {
      updateWorkspaceState({ flowId: flows[0].id });
    }
  }, [workspaceState?.flowId, flows, updateWorkspaceState]);

  const value = useMemo(
    () => ({
      systemInstanceId,
      flows,
      flowId: workspaceState?.flowId || "",
      refetch,
      isLoading,
      setFlowId,
    }),
    [
      systemInstanceId,
      flows,
      workspaceState?.flowId,
      refetch,
      isLoading,
      setFlowId,
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
