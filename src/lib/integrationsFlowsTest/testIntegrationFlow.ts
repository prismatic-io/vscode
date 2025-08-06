import { fromPromise } from "xstate";
import { fetcher } from "@/lib/fetcher";
import { IntegrationFlow } from "@/webview/machines/integration/integration.machine";
import { GraphQLVariables } from "@/types/graphql";

type TestIntegrationFlowQuery = {
  testIntegrationFlow: {
    testIntegrationFlowResult: {
      __typename: "TestIntegrationFlowResult";
      statusCode: number | null;
      headers: string | null;
      body: string | null;
      execution: {
        __typename: "InstanceExecutionResult";
        id: string;
        flowConfig: {
          __typename: "InstanceFlowConfig";
          id: string;
          flow: { __typename: "IntegrationFlow"; id: string; name: string };
        } | null;
      } | null;
    } | null;
  };
};

interface TestIntegrationFlowVariables {
  flowId: string;
}

const TEST_INTEGRATION_FLOW = `
  mutation testIntegrationFlow(
    $flowId: ID!
    $payload: String
    $contentType: String
    $headers: String
  ) {
    testIntegrationFlow(
      input: {
        id: $flowId
        payload: $payload
        contentType: $contentType
        headers: $headers
      }
    ) {
      errors {
        field
        messages
      }
      testIntegrationFlowResult {
        statusCode
        headers
        body
        execution {
          id
          flowConfig {
            id
            flow {
              id
              name
            }
          }
        }
      }
    }
  }
`;

export interface TestIntegrationFlowOutput {}

interface TestIntegrationFlowInput {
  flowId: string;
}

export const testIntegrationFlow = fromPromise<
  TestIntegrationFlowOutput,
  GraphQLVariables<TestIntegrationFlowInput>
>(async ({ input }) => {
  if (!input.accessToken || !input.prismaticUrl) {
    throw new Error("Access token and prismatic URL are required");
  }

  const response = await fetcher<
    TestIntegrationFlowQuery,
    GraphQLVariables<TestIntegrationFlowVariables>
  >(TEST_INTEGRATION_FLOW, {
    accessToken: input.accessToken,
    prismaticUrl: input.prismaticUrl,
    flowId: input.flowId,
  });

  if (response.errors) {
    throw new Error(response.errors[0].message);
  }

  const testIntegrationFlow = response.data?.testIntegrationFlow;

  if (!testIntegrationFlow) {
    throw new Error("Integration data not found in response");
  }

  return {};
});
