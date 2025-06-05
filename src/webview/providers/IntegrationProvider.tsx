import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from "react";
import { useActorRef, useSelector } from "@xstate/react";
import { useAuthContext } from "@/webview/providers/AuthProvider";
import { useVSCodeState } from "@/webview/hooks/useVSCodeState";
import {
  type IntegrationFlow,
  integrationMachine,
} from "@/webview/machines/integration/integration.machine";
import { NoIntegration } from "@/webview/components/NoIntegration";

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
  refetch: () => {},
  systemInstanceId: "",
  setFlowId: () => {},
});

export const IntegrationProvider = ({ children }: { children: ReactNode }) => {
  const { accessToken, prismaticUrl } = useAuthContext();

  const actorRef = useActorRef(integrationMachine, {
    input: { accessToken, prismaticUrl },
  });

  const { state: settingsState } = useVSCodeState({
    key: "settings",
    scope: "workspace",
  });

  useEffect(() => {
    if (settingsState?.integrationId) {
      actorRef.send({
        type: "SET_INTEGRATION_ID",
        integrationId: settingsState.integrationId,
      });
    }
  }, [settingsState, actorRef]);

  const systemInstanceId = useSelector(
    actorRef,
    (state) => state.context.systemInstanceId
  );

  const flows = useSelector(actorRef, (state) => state.context.flows);

  const flowId = useSelector(actorRef, (state) => state.context.flowId);

  const setFlowId = useCallback(
    (flowId: string) => {
      actorRef.send({ type: "SET_FLOW_ID", flowId });
    },
    [actorRef]
  );

  const refetch = useCallback(() => {
    actorRef.send({ type: "FETCH" });
  }, [actorRef]);

  const isLoading = useSelector(actorRef, (state) => state.hasTag("loading"));

  const value = useMemo(
    () => ({ systemInstanceId, flows, flowId, refetch, isLoading, setFlowId }),
    [systemInstanceId, flows, flowId, refetch, isLoading, setFlowId]
  );

  if (!settingsState?.integrationId) {
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
      "useIntegrationContext must be used within IntegrationProvider"
    );
  }

  return context;
};
