import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

import {
  OSMClient,
  OsmRequestError,
} from "../clients/osm_client.js";
import type { EventBadgeLinkCreate } from "../models/index.js";
import {
  LinkEventBadgeRequest,
  parseLinkEventBadgeRequest,
} from "../requests/link_event_badge_request.js";
import {
  badRequest,
  getRequiredRouteParam,
} from "../utils/http.js";

export async function linkEventBadge(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const sectionId = getRequiredRouteParam(request, "sectionId");
  const eventId = getRequiredRouteParam(request, "eventId");
  let body: LinkEventBadgeRequest;

  try {
    body = await parseLinkEventBadgeRequest(request);
  } catch (error) {
    return badRequest(error, "Invalid event badge link request.");
  }

  context.log(
    `Linking badge "${body.badgeId}" version "${body.badgeVersion}" column "${body.columnId}" to event "${eventId}" in section "${sectionId}".`,
  );

  const client = await OSMClient.create();

  try {
    const link: EventBadgeLinkCreate = {
      sectionId,
      eventId,
      badgeId: body.badgeId,
      badgeVersion: body.badgeVersion,
      // picture: body.picture,
      columnId: body.columnId,
      columnData: body.columnData,
      section: body.section,
      newColumnName: body.newColumnName,
    };

    return {
      status: 200,
      jsonBody: await client.linkBadgeToEvent(link),
    };
  } catch (error) {
    if (error instanceof OsmRequestError) {
      return {
        status: error.status,
        jsonBody: {
          error: error.message,
          details: error.body,
        },
      };
    }

    throw error;
  } finally {
    await client.close();
  }
}

app.http("link_event_badge", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "sections/{sectionId}/events/{eventId}/badges",
  handler: linkEventBadge,
});
