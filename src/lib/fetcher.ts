import type { GraphQLResponse, GraphQLVariables } from "@/types/graphql";

let accessToken: string | undefined;
let prismaticUrl: string | undefined;

export const fetcher = async <T, V>(
  query: string,
  variables: GraphQLVariables<V>
): Promise<GraphQLResponse<T>> => {
  const response = await fetch(
    `${prismaticUrl || variables.prismaticUrl}/api`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken || variables.accessToken}`,
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch data");
  }

  return await response.json();
};

// Only add event listener if window is available (browser environment)
if (typeof window !== "undefined") {
  window.addEventListener("message", (event) => {
    const message = event.data;

    if (
      message.type === "stateChange" &&
      message.payload.scope === "global" &&
      message.payload.key === "accessToken"
    ) {
      accessToken = message.payload.value;
    }

    if (
      message.type === "stateChange" &&
      message.payload.scope === "global" &&
      message.payload.key === "prismaticUrl"
    ) {
      prismaticUrl = message.payload.value;
    }
  });
}
