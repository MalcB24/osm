import { InvocationContext } from "@azure/functions";

import {
  getOptionalToolString,
  getRequiredToolString,
  getToolArguments,
  McpToolRequest,
  withOsmClient,
} from "../../utils/mcp.js";

export async function mcpGetScouts(
  toolRequest: McpToolRequest,
  context: InvocationContext,
): Promise<string> {
  const args = getToolArguments(toolRequest);
  const sectionId = getRequiredToolString(args, "sectionId");
  const termId = getRequiredToolString(args, "termId");

  context.log(
    `MCP getting scouts for section "${sectionId}" term "${termId}".`,
  );

  return withOsmClient(context, (client) =>
    client.getScouts(sectionId, termId, {
      section: getOptionalToolString(args, "section"),
      sort: getOptionalToolString(args, "sort"),
    }),
  );
}

export async function mcpGetTerms(
  toolRequest: McpToolRequest,
  context: InvocationContext,
): Promise<string> {
  const args = getToolArguments(toolRequest);
  const sectionId = getRequiredToolString(args, "sectionId");

  context.log(`MCP getting terms for section "${sectionId}".`);

  return withOsmClient(context, (client) =>
    client.getTerms(sectionId),
  );
}

export async function mcpGetEvents(
  toolRequest: McpToolRequest,
  context: InvocationContext,
): Promise<string> {
  const args = getToolArguments(toolRequest);
  const sectionId = getRequiredToolString(args, "sectionId");
  const termId = getRequiredToolString(args, "termId");

  context.log(
    `MCP getting events for section "${sectionId}" term "${termId}".`,
  );

  return withOsmClient(context, async (client) => {
    const events = await client.getEvents(sectionId, termId);
    const onDate = getOptionalToolString(args, "date");

    if (!onDate) {
      return events;
    }

    return events.filter((event) => {
      if (event.startdate_g) {
        return event.startdate_g === onDate;
      }

      return event.startdate === onDate;
    });
  });
}

export async function mcpGetEvent(
  toolRequest: McpToolRequest,
  context: InvocationContext,
): Promise<string> {
  const args = getToolArguments(toolRequest);
  const sectionId = getRequiredToolString(args, "sectionId");
  const eventId = getRequiredToolString(args, "eventId");

  context.log(
    `MCP getting event "${eventId}" for section "${sectionId}".`,
  );

  return withOsmClient(context, (client) =>
    client.getEvent(sectionId, eventId),
  );
}

export async function mcpGetAvailableBadges(
  toolRequest: McpToolRequest,
  context: InvocationContext,
): Promise<string> {
  const args = getToolArguments(toolRequest);
  const sectionId = getRequiredToolString(args, "sectionId");

  context.log(
    `MCP getting available badges for section "${sectionId}".`,
  );

  return withOsmClient(context, (client) =>
    client.getAvailableBadges(sectionId, {
      section: getOptionalToolString(args, "section"),
      typeId: getOptionalToolString(args, "typeId"),
      payload: getOptionalToolString(args, "payload"),
      context: getOptionalToolString(args, "context"),
      memberId: getOptionalToolString(args, "memberId"),
    }),
  );
}

export async function mcpGetBadgeRequirements(
  toolRequest: McpToolRequest,
  context: InvocationContext,
): Promise<string> {
  const args = getToolArguments(toolRequest);
  const sectionId = getRequiredToolString(args, "sectionId");
  const termId = getRequiredToolString(args, "termId");
  const badgeId = getRequiredToolString(args, "badgeId");
  const badgeVersion = getRequiredToolString(args, "badgeVersion");

  context.log(
    `MCP getting requirements for badge "${badgeId}" version "${badgeVersion}".`,
  );

  return withOsmClient(context, (client) =>
    client.getBadgeRequirements(
      sectionId,
      termId,
      badgeId,
      badgeVersion,
      {
        section: getOptionalToolString(args, "section"),
        payload: getOptionalToolString(args, "payload"),
        typeId: getOptionalToolString(args, "typeId"),
      },
    ),
  );
}
