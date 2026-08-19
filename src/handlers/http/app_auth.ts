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

function getClientSecret(): string | undefined {
  return process.env.ENTRA_CLIENT_SECRET;
}

function getBasicAuthClientSecret(request: HttpRequest): string | undefined {
  const authorization = request.headers.get("authorization");

  if (!authorization?.toLowerCase().startsWith("basic ")) {
    return undefined;
  }

  const credentials = Buffer
    .from(authorization.slice("basic ".length), "base64")
    .toString("utf8");
  const separatorIndex = credentials.indexOf(":");

  if (separatorIndex === -1) {
    return undefined;
  }

  return decodeURIComponent(credentials.slice(separatorIndex + 1));
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

function getPublicAuthBaseUrl(request: HttpRequest): string {
  return process.env.CHATGPT_AUTH_BASE_URL ?? getOrigin(request);
}

function getEntraIssuer(): string {
  return process.env.ENTRA_ISSUER ??
    `https://login.microsoftonline.com/${getTenantId()}/v2.0`;
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

function oauthError(
  status: number,
  error: string,
  errorDescription: string,
): HttpResponseInit {
  return {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Pragma: "no-cache",
    },
    jsonBody: {
      error,
      error_description: errorDescription,
    },
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
      getPublicAuthBaseUrl(request),
    ],
    scopes_supported: getScopes(),
  });
}

export async function getAuthorizationServerMetadata(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  context.log("Returning app OAuth authorization server metadata.");

  const publicAuthBaseUrl = getPublicAuthBaseUrl(request);

  return jsonResponse({
    issuer: getEntraIssuer(),
    authorization_endpoint: `${publicAuthBaseUrl}/oauth/authorize`,
    token_endpoint: `${publicAuthBaseUrl}/oauth/token`,
    jwks_uri: `https://login.microsoftonline.com/${getTenantId()}/discovery/v2.0/keys`,
    userinfo_endpoint: "https://graph.microsoft.com/oidc/userinfo",
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    subject_types_supported: ["pairwise"],
    id_token_signing_alg_values_supported: ["RS256"],
    token_endpoint_auth_methods_supported: [
      "client_secret_post",
      "client_secret_basic",
    ],
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

export async function exchangeToken(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  context.log("Exchanging app OAuth token with Entra.");

  const form = new URLSearchParams(await request.text());
  const grantType = form.get("grant_type");

  if (grantType !== "authorization_code" && grantType !== "refresh_token") {
    return oauthError(
      400,
      "unsupported_grant_type",
      "Only authorization_code and refresh_token grants are supported.",
    );
  }

  const entraForm = new URLSearchParams();

  entraForm.set("client_id", getClientId());

  const clientSecret = getClientSecret() ??
    form.get("client_secret") ??
    getBasicAuthClientSecret(request);

  if (clientSecret) {
    entraForm.set("client_secret", clientSecret);
  }

  for (const name of [
    "grant_type",
    "code",
    "redirect_uri",
    "code_verifier",
    "scope",
    "refresh_token",
  ]) {
    appendIfPresent(entraForm, form, name);
  }

  const response = await fetch(`${getEntraBaseUrl()}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: entraForm,
  });
  const body = await response.text();

  if (!response.ok) {
    context.error(`Entra token exchange failed with status ${response.status}: ${body}`);
  }

  return {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") ?? "application/json",
      "Cache-Control": "no-store",
      Pragma: "no-cache",
    },
    body,
  };
}
