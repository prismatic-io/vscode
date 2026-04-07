import type { GraphQLResponse, GraphQLVariables } from "@/types/graphql";

let accessToken: string | undefined;
let prismaticUrl: string | undefined;

export const fetcher = async <T, V>(
  query: string,
  variablesBase: GraphQLVariables<V>,
): Promise<GraphQLResponse<T>> => {
  const {
    accessToken: variableAccessToken,
    prismaticUrl: variablePrismaticUrl,
    ...variables
  } = variablesBase;

  const effectiveUrl = prismaticUrl || variablePrismaticUrl;
  const effectiveToken = accessToken || variableAccessToken;

  const response = await fetch(`${effectiveUrl}/api`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${effectiveToken}`,
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to fetch data");
  }

  return await response.json();
};

// Only add event listener if window is available (browser/webview environment)
if (typeof window !== "undefined") {
  window.addEventListener("message", (event) => {
    const message = event.data;

    if (message.type === "accessToken") {
      accessToken = message.payload.token ?? undefined;
    }

    if (message.type === "stateChange" && message.payload.scope === "global") {
      prismaticUrl = message.payload.value?.prismaticUrl ?? prismaticUrl;
    }

    if (
      message.type === "getState" &&
      message.payload.scope === "global" &&
      message.payload.value
    ) {
      prismaticUrl = message.payload.value.prismaticUrl ?? prismaticUrl;
    }
  });
}
