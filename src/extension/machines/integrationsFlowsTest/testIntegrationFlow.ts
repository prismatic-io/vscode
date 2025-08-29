import { fromPromise } from "xstate";
import { fetcher } from "@/shared/fetcher";
import type { GraphQLVariables } from "@/types/graphql";

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
  headers?: string;
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

export interface TestIntegrationFlowOutput {
  executionId: string;
}

interface TestIntegrationFlowInput {
  flowId: string;
  serverUrl?: string | undefined;
}

export const testIntegrationFlow = fromPromise<
  TestIntegrationFlowOutput,
  GraphQLVariables<TestIntegrationFlowInput>
>(async ({ input }) => {
  if (!input.accessToken || !input.prismaticUrl) {
    throw new Error("Access token and prismatic URL are required");
  }

  // Generate headers for CNI integration if server URL is provided
  let headersString: string | undefined;
  if (input.serverUrl) {
    // Try to get the public URL if we have a localhost URL
    let finalServerUrl = input.serverUrl;
    if (input.serverUrl.includes('localhost')) {
      try {
        const { getPublicUrl } = await import("@/extension/honoServer");
        const publicUrl = getPublicUrl();
        if (publicUrl && !publicUrl.includes('localhost')) {
          finalServerUrl = publicUrl;
        }
      } catch (error) {
        // Fall back to original URL if public URL unavailable
      }
    }

    // Get the global token from HonoServer
    let globalToken: string;
    try {
      const { getGlobalToken } = await import("@/extension/honoServer");
      globalToken = getGlobalToken();
    } catch (error) {
      console.error("❌ Failed to get global token:", error);
      throw new Error("Failed to get global token for CNI integration");
    }

    const cniHeaders = {
      'X-Prismatic-Server-URL': finalServerUrl,
      'X-Prismatic-Token': globalToken
    };
    headersString = JSON.stringify(cniHeaders);
  }

  const response = await fetcher<
    TestIntegrationFlowQuery,
    GraphQLVariables<TestIntegrationFlowVariables>
  >(TEST_INTEGRATION_FLOW, {
    accessToken: input.accessToken,
    prismaticUrl: input.prismaticUrl,
    flowId: input.flowId,
    headers: headersString,
  });

  if (response.errors) {
    throw new Error(response.errors[0].message);
  }

  const testIntegrationFlowResult = response.data?.testIntegrationFlow;

  if (!testIntegrationFlowResult?.testIntegrationFlowResult) {
    throw new Error("Integration test result not found in response");
  }

  const execution = testIntegrationFlowResult.testIntegrationFlowResult.execution;
  if (!execution) {
    throw new Error("Execution data not found in test result");
  }

  
  return {
    executionId: execution.id
  };
});
