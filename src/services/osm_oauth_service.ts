import crypto from "node:crypto";

import type { OAuthToken } from "../models/index.js";
import {
  KeyVaultService,
  OSM_OAUTH_STATE_SECRET,
} from "./key_vault_service.js";

const authorizationBaseUrl = "https://osm.scouts.mt/oauth/authorize";
const tokenUrl = "https://osm.scouts.mt/oauth/token";

const scope = [
  "section:member:write",
  "section:event:write",
  "section:badge:read",
  "section:administration:write",
];

export interface OsmAuthorizationStart {
  authorizationUrl: string;
  redirectUri: string;
  state: string;
}

export class OsmOAuthService {
  constructor(
    private readonly keyVault = new KeyVaultService(),
  ) {}

  async startAuthorization(
    redirectUri: string,
  ): Promise<OsmAuthorizationStart> {
    const { clientId } = await this.keyVault.getOsmCredentials();
    const state = crypto.randomBytes(24).toString("hex");
    const expiresOn = new Date(Date.now() + 15 * 60 * 1000);

    await this.keyVault.setSecret(
      OSM_OAUTH_STATE_SECRET,
      state,
      { expiresOn },
    );

    const authUrl = new URL(authorizationBaseUrl);

    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", scope.join(" "));
    authUrl.searchParams.set("state", state);

    return {
      authorizationUrl: authUrl.toString(),
      redirectUri,
      state,
    };
  }

  async exchangeAuthorizationCode(
    code: string,
    state: string,
    redirectUri: string,
  ): Promise<void> {
    const expectedState = await this.keyVault.getRequiredSecret(
      OSM_OAUTH_STATE_SECRET,
    );

    if (state !== expectedState) {
      throw new Error("OAuth state mismatch.");
    }

    const { clientId, clientSecret } =
      await this.keyVault.getOsmCredentials();

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!response.ok) {
      throw new Error(
        `Token request failed: ${response.status} ${await response.text()}`,
      );
    }

    await this.keyVault.saveOsmToken(
      this.normalizeToken((await response.json()) as OAuthToken),
    );
  }

  private normalizeToken(token: OAuthToken): OAuthToken {
    if (
      token.expires_in !== undefined &&
      token.expires_at === undefined
    ) {
      token.expires_at =
        Math.floor(Date.now() / 1000) +
        Number(token.expires_in);
    }

    return token;
  }
}
