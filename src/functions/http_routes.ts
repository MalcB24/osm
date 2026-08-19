import azureFunctions from "@azure/functions";

const { app } = azureFunctions;

import { getActualAttendance } from "../handlers/http/get_actual_attendance.js";
import { getAvailableBadges } from "../handlers/http/get_available_badges.js";
import { getBadgeRequirements } from "../handlers/http/get_badge_requirements.js";
import { getEvent } from "../handlers/http/get_event.js";
import { getEvents } from "../handlers/http/get_events.js";
import { getMarkedAttendance } from "../handlers/http/get_marked_attendance.js";
import { getScouts } from "../handlers/http/get_scouts.js";
import { getSection } from "../handlers/http/get_section.js";
import { getTerms } from "../handlers/http/get_terms.js";
import { linkEventBadge } from "../handlers/http/link_event_badge.js";
import {
  exchangeToken,
  getAuthorizationServerMetadata,
  getOpenIdConfiguration,
  getProtectedResourceMetadata,
  startAuthorization,
} from "../handlers/http/app_auth.js";
import { suggestEventBadges } from "../handlers/http/suggest_event_badges.js";
import { suggestGodBadges } from "../handlers/http/suggest_god_badges.js";
import { updateAttendedEventBadges } from "../handlers/http/update_attended_event_badges.js";
import { updateBadgeRecords } from "../handlers/http/update_badge_records.js";
import { withHttpErrors } from "../utils/http.js";

app.http("oauth_protected_resource_metadata", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: ".well-known/oauth-protected-resource",
  handler: getProtectedResourceMetadata,
});

app.http("oauth_authorization_server_metadata", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: ".well-known/oauth-authorization-server",
  handler: getAuthorizationServerMetadata,
});

app.http("oauth_authorization_server_metadata_oauth", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: ".well-known/oauth-authorization-server/oauth",
  handler: getAuthorizationServerMetadata,
});

app.http("oidc_configuration", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: ".well-known/openid-configuration",
  handler: getOpenIdConfiguration,
});

app.http("oidc_configuration_oauth", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: ".well-known/openid-configuration/oauth",
  handler: getOpenIdConfiguration,
});

app.http("oauth_authorize", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "oauth/authorize",
  handler: startAuthorization,
});

app.http("oauth_token", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "oauth/token",
  handler: exchangeToken,
});

app.http("get_section", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "api/sections",
  handler: withHttpErrors(getSection),
});

app.http("get_terms", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "api/sections/{sectionId}/terms",
  handler: withHttpErrors(getTerms),
});

app.http("get_scouts", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "api/sections/{sectionId}/terms/{termId}/scouts",
  handler: withHttpErrors(getScouts),
});

app.http("get_events", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "api/sections/{sectionId}/terms/{termId}/events",
  handler: withHttpErrors(getEvents),
});

app.http("get_event", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "api/sections/{sectionId}/events/{eventId}",
  handler: withHttpErrors(getEvent),
});

app.http("get_marked_attendance", {
  methods: ["GET"],
  authLevel: "anonymous",
  route:
    "api/sections/{sectionId}/terms/{termId}/events/{eventId}/marked-attendance",
  handler: withHttpErrors(getMarkedAttendance),
});

app.http("get_actual_attendance", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "api/sections/{sectionId}/terms/{termId}/actual-attendance",
  handler: withHttpErrors(getActualAttendance),
});

app.http("get_available_badges", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "api/sections/{sectionId}/available-badges",
  handler: withHttpErrors(getAvailableBadges),
});

app.http("get_badge_requirements", {
  methods: ["GET"],
  authLevel: "anonymous",
  route:
    "api/sections/{sectionId}/terms/{termId}/badges/{badgeId}/versions/{badgeVersion}/requirements",
  handler: withHttpErrors(getBadgeRequirements),
});

app.http("update_badge_records", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "api/sections/{sectionId}/terms/{termId}/badge-records",
  handler: withHttpErrors(updateBadgeRecords),
});

app.http("update_attended_event_badges", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "api/sections/{sectionId}/terms/{termId}/attended-event-badges",
  handler: withHttpErrors(updateAttendedEventBadges),
});

app.http("suggest_event_badges", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "api/sections/{sectionId}/terms/{termId}/event-badge-suggestions",
  handler: withHttpErrors(suggestEventBadges),
});

app.http("suggest_god_badges", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "api/sections/{sectionId}/terms/{termId}/god-badge-suggestions",
  handler: withHttpErrors(suggestGodBadges),
});

app.http("link_event_badge", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "api/sections/{sectionId}/events/{eventId}/badges",
  handler: withHttpErrors(linkEventBadge),
});
