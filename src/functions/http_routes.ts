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
  completeOsmAuth,
  startOsmAuth,
} from "../handlers/http/osm_auth.js";
import { suggestEventBadges } from "../handlers/http/suggest_event_badges.js";
import { suggestGodBadges } from "../handlers/http/suggest_god_badges.js";
import { updateAttendedEventBadges } from "../handlers/http/update_attended_event_badges.js";
import { updateBadgeRecords } from "../handlers/http/update_badge_records.js";

app.http("osm_auth", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "osm/auth",
  handler: startOsmAuth,
});

app.http("osm_auth_callback", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "osm/auth/callback",
  handler: completeOsmAuth,
});

app.http("get_section", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "sections",
  handler: getSection,
});

app.http("get_terms", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "sections/{sectionId}/terms",
  handler: getTerms,
});

app.http("get_scouts", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "sections/{sectionId}/terms/{termId}/scouts",
  handler: getScouts,
});

app.http("get_events", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "sections/{sectionId}/terms/{termId}/events",
  handler: getEvents,
});

app.http("get_event", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "sections/{sectionId}/events/{eventId}",
  handler: getEvent,
});

app.http("get_marked_attendance", {
  methods: ["GET"],
  authLevel: "anonymous",
  route:
    "sections/{sectionId}/terms/{termId}/events/{eventId}/marked-attendance",
  handler: getMarkedAttendance,
});

app.http("get_actual_attendance", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "sections/{sectionId}/terms/{termId}/actual-attendance",
  handler: getActualAttendance,
});

app.http("get_available_badges", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "sections/{sectionId}/available-badges",
  handler: getAvailableBadges,
});

app.http("get_badge_requirements", {
  methods: ["GET"],
  authLevel: "anonymous",
  route:
    "sections/{sectionId}/terms/{termId}/badges/{badgeId}/versions/{badgeVersion}/requirements",
  handler: getBadgeRequirements,
});

app.http("update_badge_records", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "sections/{sectionId}/terms/{termId}/badge-records",
  handler: updateBadgeRecords,
});

app.http("update_attended_event_badges", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "sections/{sectionId}/terms/{termId}/attended-event-badges",
  handler: updateAttendedEventBadges,
});

app.http("suggest_event_badges", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "sections/{sectionId}/terms/{termId}/event-badge-suggestions",
  handler: suggestEventBadges,
});

app.http("suggest_god_badges", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "sections/{sectionId}/terms/{termId}/god-badge-suggestions",
  handler: suggestGodBadges,
});

app.http("link_event_badge", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "sections/{sectionId}/events/{eventId}/badges",
  handler: linkEventBadge,
});
