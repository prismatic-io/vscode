import type {
  ExecutionResult,
  ExecutionResults,
  StepResult,
} from "@webview/views/executionResults/types";
import { useActorRef, useSelector } from "@xstate/react";
import { addHours, formatISO, subHours } from "date-fns";
import type { PropsWithChildren, ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from "react";
import { useAuthContext } from "@/webview/providers/AuthProvider";
import { useIntegrationContext } from "@/webview/providers/IntegrationProvider";
import { executionResultsMachine } from "@/webview/views/executionResults/machines/executionResults/executionResults.machine";
import type { StepOutputsActorRef } from "@/webview/views/executionResults/machines/stepOutputs/stepOutputs.machine";

const DEFAULT_LIMIT = 5;

const ExecutionResultsContext = createContext<{
  executionResults: ExecutionResults;
  executionResult: ExecutionResult | null;
  stepResult: StepResult | null;
  stepResultActorRef: StepOutputsActorRef | null;
  refetch: () => void;
  isLoading: boolean;
  hasLoaded: boolean;
  setExecutionResult: (executionResultId: string) => void;
  setStepResult: (stepResultId: string) => void;
}>({
  executionResults: [],
  executionResult: null,
  stepResult: null,
  stepResultActorRef: null,
  refetch: () => { },
  isLoading: false,
  hasLoaded: false,
  setExecutionResult: () => { },
  setStepResult: () => { },
});

export const ExecutionResultsProvider = ({
  children,
}: PropsWithChildren<{}>) => {
  const { accessToken, prismaticUrl } = useAuthContext();

  const { flowId } = useIntegrationContext();

  const { startDate, endDate } = useMemo(() => {
    const now = new Date();

    return {
      startDate: addHours(now, -24).toISOString(),
      endDate: addHours(now, 1).toISOString(),
    };
  }, []);

  const executionResultsMachineActorRef = useActorRef(executionResultsMachine, {
    input: {
      limit: DEFAULT_LIMIT,
      accessToken,
      prismaticUrl,
      startDate,
      endDate,
    },
  });

  useEffect(() => {
    if (flowId) {
      executionResultsMachineActorRef.send({
        type: "SET_FLOW_ID",
        flowId,
      });
    }
  }, [flowId, executionResultsMachineActorRef]);

  const executionResults = useSelector(
    executionResultsMachineActorRef,
    (state) => state.context.executionResults,
  );

  const executionResult = useSelector(
    executionResultsMachineActorRef,
    (state) => state.context.executionResult,
  );

  const setExecutionResult = useCallback(
    (executionResultId: string) => {
      executionResultsMachineActorRef.send({
        type: "SET_EXECUTION_RESULT",
        executionResultId,
      });
    },
    [executionResultsMachineActorRef],
  );

  const stepResult = useSelector(
    executionResultsMachineActorRef,
    (state) => state.context.stepResult,
  );

  const setStepResult = useCallback(
    (stepResultId: string) => {
      executionResultsMachineActorRef.send({
        type: "SET_STEP_RESULT",
        stepResultId,
      });
    },
    [executionResultsMachineActorRef],
  );

  const stepResultActorRef = useSelector(
    executionResultsMachineActorRef,
    (state) => state.context.stepResultActorRef,
  );

  const refetch = useCallback(() => {
    executionResultsMachineActorRef.send({ type: "FETCH" });
  }, [executionResultsMachineActorRef]);

  const isLoading = useSelector(executionResultsMachineActorRef, (state) =>
    state.hasTag("loading"),
  );

  const hasLoaded = useSelector(
    executionResultsMachineActorRef,
    (state) => state.context.hasLoaded,
  );

  const value = useMemo(
    () => ({
      executionResults,
      executionResult,
      stepResult,
      stepResultActorRef,
      refetch,
      isLoading,
      hasLoaded,
      setExecutionResult,
      setStepResult,
    }),
    [
      executionResults,
      executionResult,
      stepResult,
      refetch,
      isLoading,
      hasLoaded,
      setExecutionResult,
      setStepResult,
      stepResultActorRef,
    ],
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
      "useExecutionResultsContext must be used within ExecutionResultsProvider",
    );
  }

  return context;
};
