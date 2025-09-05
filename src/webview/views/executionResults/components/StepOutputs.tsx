import { format } from "date-fns";
import { useState } from "react";
import { LoadingSpinner } from "@/webview/components/LoadingSpinner";
import { useConditionalSelector } from "@/webview/hooks/useConditionalSelector";
import { DATE_TIME_FORMAT } from "@/webview/views/executionResults/components/Executions";
import { useExecutionResultsContext } from "@/webview/views/executionResults/providers/ExecutionResultsProvider";
import type { ExecutionLogs } from "@/webview/views/executionResults/types";

export const StepOutputsContainer = () => {
  const { stepResult: selectedStepResult } = useExecutionResultsContext();

  const { stepResultActorRef } = useExecutionResultsContext();

  const stepOutputs = useConditionalSelector(
    stepResultActorRef,
    (state) => state.context.output,
    null,
  );

  const stepLogs = useConditionalSelector(
    stepResultActorRef,
    (state) => state.context.logs,
    null,
  );

  const isLoading = useConditionalSelector(
    stepResultActorRef,
    (state) => state.hasTag("loading"),
    false,
  );

  const hasLoaded = useConditionalSelector(
    stepResultActorRef,
    (state) => state.context.hasLoaded,
    false,
  );

  return (
    <StepOutputs
      stepOutputs={stepOutputs}
      stepLogs={stepLogs}
      isLoading={isLoading}
      hasLoaded={hasLoaded}
      hasStepResult={Boolean(selectedStepResult)}
    />
  );
};

interface StepOutputsProps {
  stepOutputs: {
    data: unknown;
    message: string | null;
  } | null;
  stepLogs: ExecutionLogs | null;
  isLoading: boolean;
  hasLoaded: boolean;
  hasStepResult: boolean;
}

export const StepOutputs = ({
  stepOutputs,
  stepLogs,
  isLoading,
  hasLoaded,
  hasStepResult,
}: StepOutputsProps) => {
  const [tab, setTab] = useState<"outputs" | "logs">("outputs");

  return (
    <div className="column column--step-outputs">
      <div className="column__header__tabs">
        <button
          type="button"
          onClick={() => setTab("outputs")}
          className={tab === "outputs" ? "is-active" : ""}
        >
          Output
        </button>
        <button
          type="button"
          onClick={() => setTab("logs")}
          className={tab === "logs" ? "is-active" : ""}
        >
          Logs
        </button>
      </div>
      <div className="column__body">
        {hasStepResult ? (
          <>
            {isLoading ? <LoadingSpinner /> : null}
            {!isLoading ? (
              <>
                {tab === "outputs" ? (
                  <>
                    {hasLoaded && !stepOutputs ? (
                      <div className="column__body__empty">
                        No outputs found.
                      </div>
                    ) : null}
                    {hasLoaded && stepOutputs ? (
                      <>
                        {stepOutputs?.message ? (
                          <div className="column--step-outputs__message">
                            {stepOutputs.message}
                          </div>
                        ) : null}
                        {stepOutputs?.data ? (
                          <div className="column--step-outputs__output">
                            <pre>
                              <code>
                                {JSON.stringify(stepOutputs.data, null, 2)}
                              </code>
                            </pre>
                          </div>
                        ) : null}
                      </>
                    ) : null}
                  </>
                ) : null}
                {tab === "logs" ? (
                  <>
                    {hasLoaded && !stepLogs?.length ? (
                      <div className="column__body__empty">No logs found.</div>
                    ) : null}
                    {hasLoaded && stepLogs?.length
                      ? stepLogs?.map((log) => {
                          const time = format(
                            Date.parse(log.timestamp),
                            DATE_TIME_FORMAT,
                          );

                          return (
                            <div
                              className="column--step-outputs__log"
                              key={log.id}
                            >
                              <span
                                className="column--step-outputs__log__severity"
                                data-severity={log.severity}
                              />
                              <span className="column--step-outputs__log__text">
                                <span className="column--step-outputs__log__text__time">
                                  {time}
                                </span>
                                <span className="column--step-outputs__log__text__message">
                                  {log.message}
                                </span>
                              </span>
                            </div>
                          );
                        })
                      : null}
                  </>
                ) : null}
              </>
            ) : null}
          </>
        ) : (
          <div className="column__body__empty">No step result selected.</div>
        )}
      </div>
    </div>
  );
};
