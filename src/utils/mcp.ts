import type { InvocationContext } from "@azure/functions";

import {
  OSMClient,
  OsmRequestError,
} from "../clients/osm_client.js";

export interface McpToolRequest {
  arguments?: Record<string, unknown>;
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
  const client = await OSMClient.create();

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
