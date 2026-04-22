import { z } from "zod";
import { graphqlRequest } from "@/shared/graphqlClient";
import GET_AUTHENTICATED_USER from "./getAuthenticatedUser.graphql";
import LIST_USER_TENANTS from "./listUserTenants.graphql";
import {
  AuthenticatedUserSchema,
  type PrismaticUserInfo,
  type Tenant,
  TenantSchema,
} from "./types";

const AuthenticatedUserDataSchema = z.object({
  authenticatedUser: AuthenticatedUserSchema.optional(),
});

const TenantDataSchema = z.object({
  listUserTenants: z
    .object({
      nodes: z.array(TenantSchema),
    })
    .optional(),
});

export const fetchPrismaticUser = async (
  prismaticUrl: string,
  accessToken: string,
): Promise<PrismaticUserInfo> => {
  const data = await graphqlRequest(
    GET_AUTHENTICATED_USER,
    AuthenticatedUserDataSchema,
    { prismaticUrl, accessToken },
  );

  const user = data.authenticatedUser;
  if (!user) {
    throw new Error("No user data returned from API");
  }

  return {
    name: user.name ?? "",
    email: user.email ?? "",
    organization: user.org?.name ?? user.customer?.name ?? "",
    endpointUrl: prismaticUrl,
    tenantId: user.tenantId,
  };
};

export const fetchUserTenants = async (
  prismaticUrl: string,
  accessToken: string,
): Promise<Tenant[]> => {
  const data = await graphqlRequest(LIST_USER_TENANTS, TenantDataSchema, {
    prismaticUrl,
    accessToken,
  });

  return data.listUserTenants?.nodes ?? [];
};
