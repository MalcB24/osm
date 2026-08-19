import type { InvocationContext } from "@azure/functions";

import {
  OSMClient,
  OsmRequestError,
} from "../clients/osm_client.js";

export interface McpToolRequest {
  arguments?: Record<string, unknown>;

  [key: string]: unknown;
}

function getObjectKeys(value: unknown): string[] {
  return value !== null && typeof value === "object"
    ? Object.keys(value)
    : [];
}

function summarizeObject(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== "object") {
    return typeof value;
  }

  if (depth >= 3) {
    return {
      type: Array.isArray(value) ? "array" : "object",
      keys: getObjectKeys(value),
    };
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      {
        type: Array.isArray(child) ? "array" : typeof child,
        keys: getObjectKeys(child),
        shape: summarizeObject(child, depth + 1),
      },
    ]),
  );
}

export function getToolArguments(
  toolRequest: McpToolRequest,
): Record<string, unknown> {
  console.log(
    "MCP tool request shape",
    JSON.stringify({
      topLevelKeys: Object.keys(toolRequest),
      argumentKeys: getObjectKeys(toolRequest.arguments),
      metaKeys: getObjectKeys(toolRequest._meta),
      requestShape: summarizeObject(toolRequest),
    }),
  );

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
  context.log(
    "MCP invocation context shape",
    JSON.stringify({
      functionName: context.functionName,
      triggerMetadataKeys: getObjectKeys(context.triggerMetadata),
      triggerMetadataShape: summarizeObject(context.triggerMetadata),
    }),
  );

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
