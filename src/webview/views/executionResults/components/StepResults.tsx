import { LoadingSpinner } from "@/webview/components/LoadingSpinner";
import { useExecutionResultsContext } from "@/webview/views/executionResults/providers/ExecutionResultsProvider";
import type { StepResult } from "@/webview/views/executionResults/types";

export const StepResultsContainer = () => {
  const {
    executionResult: selectedExecutionResult,
    stepResult: selectedStepResult,
    setStepResult,
    isLoading,
    hasLoaded,
  } = useExecutionResultsContext();

  return (
    <StepResults
      stepResults={selectedExecutionResult?.stepResults ?? []}
      selectedStepResult={selectedStepResult}
      setStepResult={setStepResult}
      isLoading={isLoading}
      hasLoaded={hasLoaded}
      hasExecutionResult={Boolean(selectedExecutionResult)}
    />
  );
};

interface StepResultsProps {
  stepResults: StepResult[];
  selectedStepResult: StepResult | null;
  setStepResult: (stepResultId: string) => void;
  isLoading: boolean;
  hasLoaded: boolean;
  hasExecutionResult: boolean;
}

export const StepResults = ({
  stepResults,
  selectedStepResult,
  setStepResult,
  isLoading,
  hasLoaded,
  hasExecutionResult,
}: StepResultsProps) => {
  return (
    <div className="column column--step-results">
      <h4 className="column__header">Step Results</h4>
      <div className="column__body">
        {hasExecutionResult ? (
          <>
            {isLoading ? <LoadingSpinner /> : null}
            {!isLoading && hasLoaded && !stepResults.length ? (
              <div className="column__body__empty">No step results found.</div>
            ) : null}
            {!isLoading &&
              hasLoaded &&
              stepResults.map((stepResult) => {
                const startedDate = Date.parse(stepResult.startedAt);
                const endedDate = stepResult.endedAt
                  ? Date.parse(stepResult.endedAt)
                  : startedDate;
                const rawDuration = endedDate.valueOf() - startedDate.valueOf();
                const duration = (rawDuration / 1000).toFixed(1);

                return (
                  <button
                    className={`column--step-results__button ${
                      stepResult.id === selectedStepResult?.id
                        ? "column--step-results__button--active"
                        : ""
                    }`}
                    type="button"
                    key={stepResult.id}
                    onClick={() => setStepResult(stepResult.id)}
                  >
                    <span
                      className="column--step-results__button__status"
                      data-status={stepResult.hasError ? "failed" : "success"}
                    />
                    <span className="column--step-results__button__text">
                      {stepResult.displayStepName}
                    </span>
                    <span className="column--step-results__button__duration">
                      {duration}s
                    </span>
                  </button>
                );
              })}
          </>
        ) : (
          <div className="column__body__empty">No execution selected.</div>
        )}
      </div>
    </div>
  );
};
