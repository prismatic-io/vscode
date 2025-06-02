import { format } from "date-fns";
import {
  UilCalendarAlt,
  UilCloudDownload,
  UilEllipsisV,
  UilGlobe,
  UilPlayCircle,
  UilTrash,
} from "@iconscout/react-unicons";
import { useExecutionResultsContext } from "@/webview/views/executionResults/providers/ExecutionResultsProvider";
import { LoadingSpinner } from "@/webview/components/LoadingSpinner";
import { PilWebhook } from "@/webview/views/executionResults/components/PilWebhook";
import { UilArrowsLeftRight } from "@/webview/views/executionResults/components/UilArrowsLeftRight";
import {
  type ExecutionResult,
  type ExecutionResults,
  InstanceExecutionResultInvokeType,
} from "@/webview/views/executionResults/types";
import { useIntegrationContext } from "@/webview/providers/IntegrationProvider";
import { IntegrationFlow } from "@/webview/machines/integration/integration.machine";

export const ExecutionsContainer = () => {
  const { flows, flowId, setFlowId } = useIntegrationContext();

  const {
    executionResults,
    executionResult: selectedExecutionResult,
    setExecutionResult,
    isLoading,
    hasLoaded,
  } = useExecutionResultsContext();

  return (
    <Executions
      executionResults={executionResults}
      selectedExecutionResult={selectedExecutionResult}
      setExecutionResult={setExecutionResult}
      isLoading={isLoading}
      hasLoaded={hasLoaded}
      flows={flows}
      flowId={flowId}
      setFlowId={setFlowId}
    />
  );
};

interface ExecutionsProps {
  executionResults: ExecutionResults;
  selectedExecutionResult: ExecutionResult | null;
  setExecutionResult: (executionResultId: string) => void;
  isLoading: boolean;
  hasLoaded: boolean;
  flows: IntegrationFlow[];
  flowId: string;
  setFlowId: (flowId: string) => void;
}

export const Executions = ({
  executionResults,
  selectedExecutionResult,
  setExecutionResult,
  isLoading,
  hasLoaded,
  flows,
  flowId,
  setFlowId,
}: ExecutionsProps) => {
  return (
    <div className="column column--executions">
      <h4 className="column__header">Executions</h4>
      <div className="column__body">
        {flows.length > 1 ? (
          <>
            <select
              value={flowId}
              onChange={(e) => {
                setFlowId(e.target.value);
              }}
              className="column__body__select"
            >
              {flows.map((flow) => (
                <option key={flow.id} value={flow.id}>
                  {flow.name}
                </option>
              ))}
            </select>
            <hr />
          </>
        ) : null}
        {isLoading ? <LoadingSpinner /> : null}
        {!isLoading && hasLoaded && !executionResults.length ? (
          <div className="column__body__empty">No executions found.</div>
        ) : null}
        {!isLoading &&
          hasLoaded &&
          executionResults.map((executionResult) => {
            const startedDate = Date.parse(executionResult.startedAt);
            const endedDate = executionResult.endedAt
              ? Date.parse(executionResult.endedAt)
              : startedDate;
            const rawDuration = endedDate.valueOf() - startedDate.valueOf();

            const status = getStatus(executionResult.error, rawDuration);
            const time = format(startedDate, DATE_TIME_FORMAT);
            const duration = (rawDuration / 1000).toFixed(1);
            const InvocationType = executionResult.invokeType
              ? INVOCATION_TYPE_MAP[executionResult.invokeType]
              : null;

            return (
              <button
                className={`column--executions__button ${
                  executionResult.id === selectedExecutionResult?.id
                    ? "column--executions__button--active"
                    : ""
                }`}
                type="button"
                key={executionResult.id}
                onClick={() => setExecutionResult(executionResult.id)}
              >
                <span
                  className="column--executions__button__status"
                  data-status={status}
                />
                {InvocationType ? (
                  <span
                    className="column--executions__button__icon"
                    title={InvocationType?.description}
                  >
                    <InvocationType.Component />
                  </span>
                ) : null}
                <span className="column--executions__button__text">{time}</span>
                <span className="column--executions__button__duration">
                  {duration}s
                </span>
              </button>
            );
          })}
      </div>
    </div>
  );
};

export const DATE_TIME_FORMAT = "yyyy-MM-dd HH:mm:ss";

export const INVOCATION_TYPE_MAP: Record<
  InstanceExecutionResultInvokeType,
  {
    Component: (props: JSX.IntrinsicAttributes) => JSX.Element;
    description: string;
  }
> = {
  [InstanceExecutionResultInvokeType.WEBHOOK]: {
    Component: (props) => <PilWebhook {...props} />,
    description: "Webhook",
  },
  [InstanceExecutionResultInvokeType.SCHEDULED]: {
    Component: (props) => <UilCalendarAlt {...props} />,
    description: "Scheduled invocation",
  },
  [InstanceExecutionResultInvokeType.DEPLOY_FLOW]: {
    Component: (props) => <UilCloudDownload {...props} />,
    description: "Deploy flow invocation",
  },
  [InstanceExecutionResultInvokeType.TEAR_DOWN_FLOW]: {
    Component: (props) => <UilTrash {...props} />,
    description: "Tear down flow invocation",
  },
  [InstanceExecutionResultInvokeType.INTEGRATION_FLOW_TEST]: {
    Component: (props) => <UilPlayCircle {...props} />,
    description: "Manual",
  },
  [InstanceExecutionResultInvokeType.INTEGRATION_ENDPOINT_TEST]: {
    Component: (props) => <UilGlobe {...props} />,
    description: "Endpoint test",
  },
  [InstanceExecutionResultInvokeType.CROSS_FLOW]: {
    Component: (props) => <UilArrowsLeftRight {...props} />,
    description: "Cross flow",
  },
};

const getStatus = (error: string | null, duration: number) => {
  if (error) {
    return "failed";
  }

  if (duration === 0) {
    return "pending";
  }

  return "success";
};
