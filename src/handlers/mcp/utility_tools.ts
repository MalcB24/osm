import type { InvocationContext } from "@azure/functions";

import { getToday } from "../../services/date_service.js";
import {
  getOptionalToolString,
  getToolArguments,
  McpToolRequest,
} from "../../utils/mcp.js";

export async function mcpGetToday(
  toolRequest: McpToolRequest,
  context: InvocationContext,
): Promise<string> {
  const args = getToolArguments(toolRequest);
  const timeZone =
    getOptionalToolString(args, "timeZone") ?? "Europe/Malta";

  context.log(`MCP getting today's date for "${timeZone}".`);

  return JSON.stringify(getToday(timeZone));
}
