import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from "react";
import { useActorRef, useSelector } from "@xstate/react";
import { useAuthContext } from "@webview/lib/AuthProvider";
import { useIntegrationContext } from "@webview/lib/IntegrationProvider";
import { executionResultsMachine } from "./executionResults.machine";
import type { ExecutionResult } from "./getExecutionResults";

const ExecutionResultsContext = createContext<{
  executionResults: ExecutionResult[];
  refetch: () => void;
  isLoading: boolean;
}>({
  executionResults: [],
  refetch: () => {},
  isLoading: false,
});

export const ExecutionResultsProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const { accessToken, prismaticUrl } = useAuthContext();

  const { flowId } = useIntegrationContext();

  const actorRef = useActorRef(executionResultsMachine, {
    input: { limit: 10, accessToken, prismaticUrl },
  });

  useEffect(() => {
    if (flowId) {
      actorRef.send({
        type: "SET_FLOW_ID",
        flowId,
      });
    }
  }, [flowId, actorRef]);

  const executionResults = useSelector(
    actorRef,
    (state) => state.context.executionResults
  );

  const refetch = useCallback(() => {
    actorRef.send({ type: "FETCH" });
  }, [actorRef]);

  const isLoading = useSelector(actorRef, (state) => state.hasTag("loading"));

  const value = useMemo(
    () => ({ executionResults, refetch, isLoading }),
    [executionResults, refetch, isLoading]
  );

  return (
    <ExecutionResultsContext.Provider value={value}>
      {children}
    </ExecutionResultsContext.Provider>
  );
};

export const useExecutionResultsContext = () => {
  const context = useContext(ExecutionResultsContext);

  if (!context) {
    throw new Error(
      "useExecutionResultsContext must be used within ExecutionResultsProvider"
    );
  }

  return context;
};
