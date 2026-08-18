import type { InvocationContext } from "@azure/functions";

import type {
  CreateEventBadgeLinkRequest,
  SuggestGodBadgesRequest,
  SuggestEventBadgesRequest,
} from "../../models/index.js";
import { AzureOpenAIService } from "../../services/azure_openai_service.js";
import {
  createEventBadgeSuggestions,
  createGodBadgeSuggestion,
} from "../../services/event_badge_suggestion_service.js";
import {
  getOptionalToolString,
  getRequiredToolString,
  getToolArguments,
  McpToolRequest,
  withOsmClient,
} from "../../utils/mcp.js";

export async function mcpSuggestEventBadges(
  toolRequest: McpToolRequest,
  context: InvocationContext,
): Promise<string> {
  const args = getToolArguments(toolRequest);
  const sectionId = getRequiredToolString(args, "sectionId");
  const termId = getRequiredToolString(args, "termId");
  const date = getOptionalToolString(args, "date");
  const eventId = getOptionalToolString(args, "eventId");

  if (!date && !eventId) {
    throw new Error('Supply either "eventId" or "date".');
  }

  context.log(
    `MCP suggesting badge matches for section "${sectionId}" term "${termId}".`,
  );

  const body: SuggestEventBadgesRequest = {
    date,
    eventId,
    section: getOptionalToolString(args, "section"),
    typeId: getOptionalToolString(args, "typeId"),
    payload: getOptionalToolString(args, "payload"),
    context: getOptionalToolString(args, "context"),
    memberId: getOptionalToolString(args, "memberId"),
  };
  const ai = await AzureOpenAIService.create();

  return withOsmClient(context, async (client) => {
    const suggestions = await createEventBadgeSuggestions(
      client,
      ai,
      sectionId,
      termId,
      body,
    );

    return eventId
      ? suggestions[0] ?? {
          eventName: "",
          eventDescription: "",
          possibleBadges: {},
        }
      : {
          date,
          events: suggestions,
        };
  });
}

export async function mcpLinkEventBadge(
  toolRequest: McpToolRequest,
  context: InvocationContext,
): Promise<string> {
  const args = getToolArguments(toolRequest);
  const sectionId = getRequiredToolString(args, "sectionId");
  const eventId = getRequiredToolString(args, "eventId");
  const link: CreateEventBadgeLinkRequest = {
    sectionId,
    eventId,
    badgeId: getRequiredToolString(args, "badgeId"),
    badgeVersion: getRequiredToolString(args, "badgeVersion"),
    columnId: getRequiredToolString(args, "columnId"),
    columnData: getRequiredToolString(args, "columnData"),
    section: getOptionalToolString(args, "section"),
    newColumnName: getOptionalToolString(args, "newColumnName"),
  };

  context.log(
    `MCP linking badge "${link.badgeId}" version "${link.badgeVersion}" column "${link.columnId}" to event "${eventId}".`,
  );

  return withOsmClient(context, (client) =>
    client.linkBadgeToEvent(link),
  );
}

export async function mcpSuggestGodBadges(
  toolRequest: McpToolRequest,
  context: InvocationContext,
): Promise<string> {
  const args = getToolArguments(toolRequest);
  const sectionId = getRequiredToolString(args, "sectionId");
  const termId = getRequiredToolString(args, "termId");
  const body: SuggestGodBadgesRequest = {
    description: getRequiredToolString(args, "description"),
    name: getOptionalToolString(args, "name"),
    section: getOptionalToolString(args, "section"),
    typeId: getOptionalToolString(args, "typeId"),
    payload: getOptionalToolString(args, "payload"),
    context: getOptionalToolString(args, "context"),
    memberId: getOptionalToolString(args, "memberId"),
  };
  const ai = await AzureOpenAIService.create();

  context.log(
    `MCP suggesting god badge matches for section "${sectionId}" term "${termId}".`,
  );

  return withOsmClient(context, (client) =>
    createGodBadgeSuggestion(client, ai, sectionId, termId, body),
  );
}
