import type { InvocationContext } from "@azure/functions";

import {
  OSMClient,
  OsmRequestError,
} from "../clients/osm_client.js";

export interface McpToolRequest {
  arguments?: Record<string, unknown>;

  [key: string]: unknown;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object"
    ? value as Record<string, unknown>
    : undefined;
}

function getRecordProperty(
  value: unknown,
  name: string,
): unknown {
  const record = asRecord(value);

  if (!record) {
    return undefined;
  }

  return record[name] ??
    record[name.toLowerCase()] ??
    record[name.toUpperCase()];
}

function getHeader(
  headers: unknown,
  name: string,
): string | undefined {
  const value = getRecordProperty(headers, name);

  return typeof value === "string" && value.length > 0
    ? value
    : undefined;
}

function getMcpAuthorizationHeader(
  context: InvocationContext,
): string | undefined {
  const transport = getRecordProperty(context.triggerMetadata, "transport");
  const properties = getRecordProperty(transport, "properties");
  const headers = getRecordProperty(properties, "headers");

  return getHeader(headers, "authorization");
}

function getBearerToken(
  authorizationHeader: string | undefined,
): string | undefined {
  if (!authorizationHeader?.toLowerCase().startsWith("bearer ")) {
    return undefined;
  }

  return authorizationHeader.slice("bearer ".length).trim();
}

export function getToolArguments(
  toolRequest: McpToolRequest,
): Record<string, unknown> {
  return toolRequest.arguments ?? {};
}

export function getRequiredToolString(
  args: Record<string, unknown>,
  name: string,
): string {
  const value = args[name];

  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing or invalid "${name}".`);
  }

  return value;
}

export function getOptionalToolString(
  args: Record<string, unknown>,
  name: string,
): string | undefined {
  const value = args[name];

  return typeof value === "string" && value.length > 0
    ? value
    : undefined;
}

export function getOptionalToolBoolean(
  args: Record<string, unknown>,
  name: string,
): boolean | undefined {
  const value = args[name];

  return typeof value === "boolean" ? value : undefined;
}

export async function withOsmClient<T>(
  context: InvocationContext,
  action: (client: OSMClient) => Promise<T>,
): Promise<string> {
  const bearerToken = getBearerToken(getMcpAuthorizationHeader(context));

  if (!bearerToken) {
    context.error("Missing Authorization bearer token for MCP request.");

    return JSON.stringify({
      error: "Missing Authorization bearer token.",
    });
  }

  const client = await OSMClient.createWithAccessToken(bearerToken);

  context.log("Using caller OSM bearer token for MCP request.");

  try {
    return JSON.stringify(await action(client));
  } catch (error) {
    if (error instanceof OsmRequestError) {
      context.error(error.message);

      return JSON.stringify({
        error: error.message,
        details: error.body,
      });
    }

    throw error;
  } finally {
    await client.close();
  }
}
