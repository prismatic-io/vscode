import { z } from "zod";

export const AuthMetaSchema = z.object({
  domain: z.string(),
  audience: z.string(),
  clientId: z.string(),
  connection: z.string(),
});
export type AuthMeta = z.infer<typeof AuthMetaSchema>;

export const OIDCDiscoverySchema = z.object({
  authorization_endpoint: z.url(),
  token_endpoint: z.url(),
  userinfo_endpoint: z.url(),
  revocation_endpoint: z.url(),
});

export interface OIDCEndpoints {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userinfoEndpoint: string;
  revocationEndpoint: string;
}

export const TokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  id_token: z.string(),
  expires_in: z.number().int().positive(),
});
export type TokenResponse = z.infer<typeof TokenResponseSchema>;

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresAt: number;
  tenantId?: string;
}

export const TenantSchema = z.object({
  tenantId: z.string(),
  url: z.string(),
  orgName: z.string(),
  awsRegion: z.string(),
});
export type Tenant = z.infer<typeof TenantSchema>;

export const AuthenticatedUserSchema = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
  tenantId: z.string().optional(),
  org: z.object({ name: z.string().optional() }).optional().nullable(),
  customer: z.object({ name: z.string().optional() }).optional().nullable(),
});

export interface PrismaticUserInfo {
  name: string;
  email: string;
  organization: string;
  endpointUrl: string;
  tenantId?: string;
}
