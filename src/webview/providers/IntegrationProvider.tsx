import { useActorRef, useSelector } from "@xstate/react";
import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from "react";
import type { Flow } from "@/types/flows";
import { NoIntegration } from "@/webview/components/NoIntegration";
import { useVSCodeState } from "@/webview/hooks/useVSCodeState";
import { integrationMachine } from "@/webview/machines/integration/integration.machine";
import { useAuthContext } from "@/webview/providers/AuthProvider";

const IntegrationContext = createContext<{
  flow: Flow | null;
  flows: Flow[];
  isLoading: boolean;
  refetch: () => void;
  systemInstanceId: string;
  setFlow: (flowId: string) => void;
}>({
  flow: null,
  flows: [],
  isLoading: false,
  refetch: () => {},
  systemInstanceId: "",
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

  const value = useMemo(
    () => ({
      systemInstanceId,
      flows,
      flow: workspaceState?.flow ?? null,
      refetch,
      isLoading,
      setFlow,
    }),
    [
      systemInstanceId,
      flows,
      workspaceState?.flow,
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
