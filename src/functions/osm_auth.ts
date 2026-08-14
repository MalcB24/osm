import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

import { OsmOAuthService } from "../services/osm_oauth_service.js";

function getCallbackUrl(request: HttpRequest): string {
  if (process.env.OSM_REDIRECT_URI) {
    return process.env.OSM_REDIRECT_URI;
  }

  const callbackUrl = new URL(request.url);

  callbackUrl.pathname = "/api/osm/auth/callback";
  callbackUrl.search = "";
  callbackUrl.hash = "";

  return callbackUrl.toString();
}

export async function startOsmAuth(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  context.log("Starting OSM OAuth authorization.");

  const auth = new OsmOAuthService();
  const { authorizationUrl } = await auth.startAuthorization(
    getCallbackUrl(request),
  );

  return {
    status: 302,
    headers: {
      Location: authorizationUrl,
    },
  };
}

export async function completeOsmAuth(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  context.log("Completing OSM OAuth authorization.");

  const code = request.query.get("code");
  const state = request.query.get("state");

  if (!code) {
    return {
      status: 400,
      body: "Missing OAuth authorization code.",
    };
  }

  if (!state) {
    return {
      status: 400,
      body: "Missing OAuth state.",
    };
  }

  const auth = new OsmOAuthService();

  await auth.exchangeAuthorizationCode(
    code,
    state,
    getCallbackUrl(request),
  );

  return {
    status: 200,
    body: "OSM authorization complete. The token has been saved to Key Vault.",
  };
}

app.http("osm_auth", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "osm/auth",
  handler: startOsmAuth,
});

app.http("osm_auth_callback", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "osm/auth/callback",
  handler: completeOsmAuth,
});
