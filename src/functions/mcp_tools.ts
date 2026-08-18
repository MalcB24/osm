import azureFunctions from "@azure/functions";

const { app, arg } = azureFunctions;

import {
  mcpGetAvailableBadges,
  mcpGetBadgeRequirements,
  mcpGetEvent,
  mcpGetEvents,
  mcpGetScouts,
  mcpGetSections,
  mcpGetTerms,
} from "../handlers/mcp/osm_read_tools.js";
import {
  mcpLinkEventBadge,
  mcpSuggestEventBadges,
  mcpSuggestGodBadges,
} from "../handlers/mcp/event_badge_tools.js";

app.mcpTool("osm_get_scouts", {
  toolName: "osm_get_scouts",
  description: "Get scouts for a section and term from OSM.",
  toolProperties: {
    sectionId: arg.string().describe("OSM section id."),
    termId: arg.string().describe("OSM term id."),
    section: arg.string().optional().describe("OSM section slug."),
    sort: arg.string().optional().describe("Sort field."),
  },
  handler: mcpGetScouts,
});

app.mcpTool("osm_get_sections", {
  toolName: "osm_get_sections",
  description:
    "Get OSM sections available to the authenticated user, with their current term ids.",
  toolProperties: {},
  handler: mcpGetSections,
});

app.mcpTool("osm_get_terms", {
  toolName: "osm_get_terms",
  description: "Get OSM terms for a section.",
  toolProperties: {
    sectionId: arg.string().describe("OSM section id."),
  },
  handler: mcpGetTerms,
});

app.mcpTool("osm_get_events", {
  toolName: "osm_get_events",
  description: "Get OSM events for a section and term.",
  toolProperties: {
    sectionId: arg.string().describe("OSM section id."),
    termId: arg.string().describe("OSM term id."),
    date: arg
      .string()
      .optional()
      .describe("Optional date filter in YYYY-MM-DD format."),
  },
  handler: mcpGetEvents,
});

app.mcpTool("osm_get_event", {
  toolName: "osm_get_event",
  description: "Get full OSM event details, including linked badges.",
  toolProperties: {
    sectionId: arg.string().describe("OSM section id."),
    eventId: arg.string().describe("OSM event id."),
  },
  handler: mcpGetEvent,
});

app.mcpTool("osm_get_available_badges", {
  toolName: "osm_get_available_badges",
  description: "Get available badges for an OSM section.",
  toolProperties: {
    sectionId: arg.string().describe("OSM section id."),
    section: arg.string().optional().describe("OSM section slug."),
    typeId: arg.string().optional().describe("OSM badge type id."),
    payload: arg.string().optional().describe("OSM payload value."),
    context: arg.string().optional().describe("OSM badge context."),
    memberId: arg.string().optional().describe("OSM member id."),
  },
  handler: mcpGetAvailableBadges,
});

app.mcpTool("osm_get_badge_requirements", {
  toolName: "osm_get_badge_requirements",
  description: "Get requirements for an OSM badge.",
  toolProperties: {
    sectionId: arg.string().describe("OSM section id."),
    termId: arg.string().describe("OSM term id."),
    badgeId: arg.string().describe("Badge id."),
    badgeVersion: arg.string().describe("Badge version."),
    section: arg.string().optional().describe("OSM section slug."),
    payload: arg.string().optional().describe("OSM payload value."),
    typeId: arg.string().optional().describe("OSM badge type id."),
  },
  handler: mcpGetBadgeRequirements,
});

app.mcpTool("osm_suggest_event_badges", {
  toolName: "osm_suggest_event_badges",
  description:
    "Suggest badge requirements that fit an OSM event description.",
  toolProperties: {
    sectionId: arg.string().describe("OSM section id."),
    termId: arg.string().describe("OSM term id."),
    eventId: arg
      .string()
      .optional()
      .describe("Event id. Supply this or date."),
    date: arg
      .string()
      .optional()
      .describe("Date in YYYY-MM-DD format. Used when eventId is not supplied."),
    section: arg.string().optional().describe("OSM section slug."),
    typeId: arg.string().optional().describe("OSM badge type id."),
    payload: arg.string().optional().describe("OSM payload value."),
    context: arg.string().optional().describe("OSM badge context."),
    memberId: arg.string().optional().describe("OSM member id."),
  },
  handler: mcpSuggestEventBadges,
});

app.mcpTool("osm_suggest_god_badges", {
  toolName: "osm_suggest_god_badges",
  description:
    "Suggest Olympian Missions god badge requirements that fit a manually supplied description.",
  toolProperties: {
    sectionId: arg.string().describe("OSM section id."),
    termId: arg.string().describe("OSM term id."),
    description: arg
      .string()
      .describe("Manual event or activity description to match."),
    name: arg
      .string()
      .optional()
      .describe("Optional name for the supplied description."),
    section: arg.string().optional().describe("OSM section slug."),
    typeId: arg.string().optional().describe("OSM badge type id."),
    payload: arg.string().optional().describe("OSM payload value."),
    context: arg.string().optional().describe("OSM badge context."),
    memberId: arg.string().optional().describe("OSM member id."),
  },
  handler: mcpSuggestGodBadges,
});

app.mcpTool("osm_link_event_badge", {
  toolName: "osm_link_event_badge",
  description: "Link a badge requirement to an OSM event.",
  toolProperties: {
    sectionId: arg.string().describe("OSM section id."),
    eventId: arg.string().describe("OSM event id."),
    badgeId: arg.string().describe("Badge id."),
    badgeVersion: arg.string().describe("Badge version."),
    columnId: arg.string().describe("Badge requirement column id."),
    columnData: arg.string().describe("Text shown against the link."),
    section: arg.string().optional().describe("OSM section slug."),
    newColumnName: arg
      .string()
      .optional()
      .describe("Optional new column name."),
  },
  handler: mcpLinkEventBadge,
});
