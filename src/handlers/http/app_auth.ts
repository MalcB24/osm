import {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

const defaultScope = "openid profile email offline_access";

function getOrigin(request: HttpRequest): string {
  const url = new URL(request.url);

  return `${url.protocol}//${url.host}`;
}

function getRequiredSetting(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required app setting "${name}".`);
  }

  return value;
}

function getTenantId(): string {
  return getRequiredSetting("ENTRA_TENANT_ID");
}

function getClientId(): string {
  return getRequiredSetting("ENTRA_CLIENT_ID");
}

function getScope(): string {
  return process.env.CHATGPT_AUTH_SCOPE ??
    process.env.CHATGPT_MCP_AUTH_SCOPE ??
    defaultScope;
}

function getResourceUrl(request: HttpRequest): string {
  return process.env.CHATGPT_AUTH_RESOURCE_URL ??
    process.env.CHATGPT_MCP_RESOURCE_URL ??
    getOrigin(request);
}

function getIssuer(request: HttpRequest): string {
  return process.env.CHATGPT_AUTH_ISSUER ??
    process.env.CHATGPT_MCP_AUTH_ISSUER ??
    getOrigin(request);
}

function getEntraBaseUrl(): string {
  return `https://login.microsoftonline.com/${getTenantId()}/oauth2/v2.0`;
}

function getScopes(): string[] {
  return getScope().split(/\s+/).filter(Boolean);
}

function jsonResponse(jsonBody: unknown): HttpResponseInit {
  return {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
    jsonBody,
  };
}

function appendIfPresent(
  target: URLSearchParams,
  source: URLSearchParams,
  name: string,
): void {
  const value = source.get(name);

  if (value) {
    target.set(name, value);
  }
}

export async function getProtectedResourceMetadata(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  context.log("Returning app OAuth protected resource metadata.");

  return jsonResponse({
    resource: getResourceUrl(request),
    authorization_servers: [
      getIssuer(request),
    ],
    scopes_supported: getScopes(),
  });
}

export async function getAuthorizationServerMetadata(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  context.log("Returning app OAuth authorization server metadata.");

  const issuer = getIssuer(request);
  const entraBaseUrl = getEntraBaseUrl();

  return jsonResponse({
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${entraBaseUrl}/token`,
    jwks_uri: `https://login.microsoftonline.com/${getTenantId()}/discovery/v2.0/keys`,
    userinfo_endpoint: "https://graph.microsoft.com/oidc/userinfo",
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: getScopes(),
  });
}

export async function getOpenIdConfiguration(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  context.log("Returning app OpenID configuration metadata.");

  return getAuthorizationServerMetadata(request, context);
}

export async function startAuthorization(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  context.log("Redirecting app OAuth authorization to Entra.");

  const authorizationUrl = new URL(`${getEntraBaseUrl()}/authorize`);

  authorizationUrl.searchParams.set("client_id", getClientId());
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("scope", getScope());

  appendIfPresent(authorizationUrl.searchParams, request.query, "redirect_uri");
  appendIfPresent(authorizationUrl.searchParams, request.query, "state");
  appendIfPresent(authorizationUrl.searchParams, request.query, "code_challenge");
  appendIfPresent(authorizationUrl.searchParams, request.query, "code_challenge_method");
  appendIfPresent(authorizationUrl.searchParams, request.query, "resource");
  appendIfPresent(authorizationUrl.searchParams, request.query, "prompt");
  appendIfPresent(authorizationUrl.searchParams, request.query, "login_hint");

  return {
    status: 302,
    headers: {
      Location: authorizationUrl.toString(),
    },
  };
}
