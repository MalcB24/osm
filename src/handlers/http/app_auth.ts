import {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

const authorizationBaseUrl = "https://osm.scouts.mt/oauth/authorize";
const tokenUrl = "https://osm.scouts.mt/oauth/token";
const resourceUrl = "https://osm.scouts.mt/oauth/resource";
const supportedScopes = [
  "section:administration:read",
  "section:administration:write",
  "section:administration:admin",
  "section:attendance:read",
  "section:attendance:write",
  "section:badge:read",
  "section:badge:write",
  "section:event:read",
  "section:event:write",
  "section:finance:read",
  "section:finance:write",
  "section:finance:admin",
  "section:flexirecord:read",
  "section:flexirecord:write",
  "section:member:read",
  "section:member:write",
  "section:programme:read",
  "section:programme:write",
  "section:quartermaster:read",
  "section:quartermaster:write",
];
const defaultScopes = [
  "section:member:read",
  "section:event:read",
  "section:badge:read",
  "section:attendance:read",
];
const defaultScope = defaultScopes.join(" ");

function getOrigin(request: HttpRequest): string {
  const url = new URL(request.url);

  return `${url.protocol}//${url.host}`;
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

function getResourceUrl(request: HttpRequest): string {
  return process.env.CHATGPT_AUTH_RESOURCE_URL ??
    process.env.CHATGPT_MCP_RESOURCE_URL ??
    getOrigin(request);
}

function getPublicAuthBaseUrl(request: HttpRequest): string {
  return process.env.CHATGPT_AUTH_BASE_URL ?? getOrigin(request);
}

function getIssuer(request: HttpRequest): string {
  return process.env.CHATGPT_AUTH_ISSUER ?? getPublicAuthBaseUrl(request);
}

function getScopes(): string[] {
  return supportedScopes;
}

function getRequestedScope(request: HttpRequest): string {
  return request.query.get("scope") ?? defaultScope;
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
    issuer: getIssuer(request),
    authorization_endpoint: `${publicAuthBaseUrl}/oauth/authorize`,
    token_endpoint: `${publicAuthBaseUrl}/oauth/token`,
    userinfo_endpoint: resourceUrl,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
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
  context.log("Redirecting app OAuth authorization to OSM.");

  const clientId = request.query.get("client_id");

  if (!clientId) {
    return oauthError(
      400,
      "invalid_request",
      "Missing OAuth client id.",
    );
  }

  const authorizationUrl = new URL(authorizationBaseUrl);

  authorizationUrl.searchParams.set("client_id", clientId);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("scope", getRequestedScope(request));

  appendIfPresent(authorizationUrl.searchParams, request.query, "redirect_uri");
  appendIfPresent(authorizationUrl.searchParams, request.query, "state");
  appendIfPresent(authorizationUrl.searchParams, request.query, "code_challenge");
  appendIfPresent(authorizationUrl.searchParams, request.query, "code_challenge_method");

  if (
    authorizationUrl.searchParams.has("code_challenge") &&
    !authorizationUrl.searchParams.has("code_challenge_method")
  ) {
    authorizationUrl.searchParams.set("code_challenge_method", "S256");
  }

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
  context.log("Exchanging app OAuth token with OSM.");

  const form = new URLSearchParams(await request.text());
  const grantType = form.get("grant_type");

  if (grantType !== "authorization_code" && grantType !== "refresh_token") {
    return oauthError(
      400,
      "unsupported_grant_type",
      "Only authorization_code and refresh_token grants are supported.",
    );
  }

  const tokenForm = new URLSearchParams();
  const clientId = form.get("client_id");

  const incomingClientSecret = form.get("client_secret") ??
    getBasicAuthClientSecret(request);

  if (!clientId) {
    return oauthError(
      400,
      "invalid_request",
      "Missing OAuth client id.",
    );
  }

  if (!incomingClientSecret) {
    return oauthError(
      401,
      "invalid_client",
      "Missing OAuth client secret.",
    );
  }

  tokenForm.set("client_id", clientId);
  tokenForm.set("client_secret", incomingClientSecret);

  for (const name of [
    "grant_type",
    "code",
    "redirect_uri",
    "code_verifier",
    "scope",
    "refresh_token",
  ]) {
    appendIfPresent(tokenForm, form, name);
  }

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: tokenForm,
  });
  const body = await response.text();

  if (!response.ok) {
    context.error(`OSM token exchange failed with status ${response.status}: ${body}`);
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
