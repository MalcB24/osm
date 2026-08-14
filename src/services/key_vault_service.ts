import { DefaultAzureCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";

import type {
  AzureSdkError,
  OAuthToken,
} from "../models/index.js";

export const OSM_CLIENT_ID_SECRET = "osm-client-id";
export const OSM_CLIENT_SECRET_SECRET = "osm-client-secret";
export const OSM_TOKEN_SECRET = "osm-token";
export const OSM_OAUTH_STATE_SECRET = "osm-oauth-state";

export interface OsmCredentials {
  clientId: string;
  clientSecret: string;
}

export class KeyVaultService {
  private readonly client: SecretClient;

  constructor() {
    const vaultName = process.env.AZURE_KEY_VAULT_NAME;

    if (!vaultName) {
      throw new Error(
        "AZURE_KEY_VAULT_NAME environment variable is not set.",
      );
    }

    const credential = new DefaultAzureCredential();

    this.client = new SecretClient(
      `https://${vaultName}.vault.azure.net`,
      credential,
    );
  }

  async getRequiredSecret(name: string): Promise<string> {
    try {
      const secret = await this.client.getSecret(name);

      if (!secret.value) {
        throw new Error(`Key Vault secret "${name}" has no value.`);
      }

      return secret.value;
    } catch (error) {
      const azureError = error as AzureSdkError;

      if (azureError.statusCode === 404) {
        throw new Error(`Key Vault secret "${name}" is required.`);
      }

      throw error;
    }
  }

  async setSecret(
    name: string,
    value: string,
    options: { expiresOn?: Date } = {},
  ): Promise<void> {
    await this.client.setSecret(name, value, options);
  }

  async getOsmCredentials(): Promise<OsmCredentials> {
    const [clientId, clientSecret] = await Promise.all([
      this.getRequiredSecret(OSM_CLIENT_ID_SECRET),
      this.getRequiredSecret(OSM_CLIENT_SECRET_SECRET),
    ]);

    return { clientId, clientSecret };
  }

  async getOsmToken(): Promise<OAuthToken> {
    return JSON.parse(
      await this.getRequiredSecret(OSM_TOKEN_SECRET),
    ) as OAuthToken;
  }

  async saveOsmToken(token: OAuthToken): Promise<void> {
    await this.setSecret(
      OSM_TOKEN_SECRET,
      JSON.stringify(token),
    );
  }
}
