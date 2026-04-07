import {
  type AuthMeta,
  AuthMetaSchema,
  OIDCDiscoverySchema,
  type OIDCEndpoints,
} from "./types";

const authMetaCache = new Map<string, AuthMeta>();
const oidcEndpointsCache = new Map<string, OIDCEndpoints>();

export const fetchAuthMeta = async (
  prismaticUrl: string,
): Promise<AuthMeta> => {
  const cached = authMetaCache.get(prismaticUrl);
  if (cached) return cached;

  const response = await fetch(`${prismaticUrl}/auth/meta`);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch auth config from ${prismaticUrl}/auth/meta: ${response.status} ${response.statusText}`,
    );
  }

  const data = AuthMetaSchema.parse(await response.json());
  authMetaCache.set(prismaticUrl, data);
  return data;
};

export const fetchOIDCEndpoints = async (
  domain: string,
): Promise<OIDCEndpoints> => {
  const cached = oidcEndpointsCache.get(domain);
  if (cached) return cached;

  const response = await fetch(
    `https://${domain}/.well-known/openid-configuration`,
  );
  if (!response.ok) {
    throw new Error(
      `Failed to fetch OIDC configuration from ${domain}: ${response.status} ${response.statusText}`,
    );
  }

  const data = OIDCDiscoverySchema.parse(await response.json());
  const endpoints: OIDCEndpoints = {
    authorizationEndpoint: data.authorization_endpoint,
    tokenEndpoint: data.token_endpoint,
    userinfoEndpoint: data.userinfo_endpoint,
    revocationEndpoint: data.revocation_endpoint,
  };

  oidcEndpointsCache.set(domain, endpoints);
  return endpoints;
};

export const clearDiscoveryCache = (prismaticUrl?: string): void => {
  if (prismaticUrl) {
    const meta = authMetaCache.get(prismaticUrl);
    authMetaCache.delete(prismaticUrl);
    if (meta) {
      oidcEndpointsCache.delete(meta.domain);
    }
  } else {
    authMetaCache.clear();
    oidcEndpointsCache.clear();
  }
};
