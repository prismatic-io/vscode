import type { ZodType, infer as zInfer } from "zod";
import { z } from "zod";

const GraphQLErrorsSchema = z.array(z.object({ message: z.string() }));

const graphqlResponseSchema = <T extends ZodType>(dataSchema: T) =>
  z.object({
    data: dataSchema.optional(),
    errors: GraphQLErrorsSchema.optional(),
  });

export interface GraphQLRequestOptions {
  prismaticUrl: string;
  accessToken: string;
}

/**
 * Execute a GraphQL request with zod schema validation.
 * Validates the response data against the provided schema and returns typed data.
 */
export const graphqlRequest = async <TSchema extends ZodType>(
  query: string,
  schema: TSchema,
  options: GraphQLRequestOptions,
  variables?: Record<string, unknown>,
): Promise<zInfer<TSchema>> => {
  const response = await fetch(`${options.prismaticUrl}/api`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.accessToken}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.status}`);
  }

  const responseSchema = graphqlResponseSchema(schema);
  const parsed = responseSchema.parse(await response.json());

  if (parsed.errors?.length) {
    throw new Error(`GraphQL error: ${parsed.errors[0].message}`);
  }

  if (parsed.data === undefined) {
    throw new Error("No data returned from GraphQL API");
  }

  return parsed.data;
};
