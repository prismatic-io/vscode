import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from "react";
import { useActorRef, useSelector } from "@xstate/react";
import { useAuthContext } from "@/webview/lib/AuthProvider";
import { useVSCodeState } from "@/webview/lib/useVSCodeState";
import { integrationMachine } from "@/webview/lib/integration.machine";

const IntegrationContext = createContext<{
  flowId: string;
  flows: { id: string; name: string }[];
  isLoading: boolean;
  refetch: () => void;
  systemInstanceId: string;
}>({
  flowId: "",
  flows: [],
  isLoading: false,
  refetch: () => {},
  systemInstanceId: "",
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

  const refetch = useCallback(() => {
    actorRef.send({ type: "FETCH" });
  }, [actorRef]);

  const isLoading = useSelector(actorRef, (state) => state.hasTag("loading"));

  const value = useMemo(
    () => ({ systemInstanceId, flows, flowId, refetch, isLoading }),
    [systemInstanceId, flows, flowId, refetch, isLoading]
  );

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
