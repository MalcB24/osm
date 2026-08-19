import {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

import { createOsmClientForRequest } from "../../utils/http.js";

import {
  OSMClient,
  OsmRequestError,
} from "../../clients/osm_client.js";
import type { SuggestEventBadgesRequest } from "../../models/index.js";
import { parseSuggestEventBadgesRequest } from "../../requests/suggest_event_badges_request.js";
import { AzureOpenAIService } from "../../services/azure_openai_service.js";
import { createEventBadgeSuggestions } from "../../services/event_badge_suggestion_service.js";
import {
  badRequest,
  getRequiredRouteParam,
} from "../../utils/http.js";

export async function suggestEventBadges(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const sectionId = getRequiredRouteParam(request, "sectionId");
  const termId = getRequiredRouteParam(request, "termId");
  let body: SuggestEventBadgesRequest;

  try {
    body = await parseSuggestEventBadgesRequest(request);
  } catch (error) {
    return badRequest(
      error,
      "Invalid event badge suggestion request.",
    );
  }

  context.log(
    `Suggesting badge matches for section "${sectionId}" term "${termId}".`,
  );

  const client = await createOsmClientForRequest(request);

  try {
    const ai = await AzureOpenAIService.create();
    const suggestions = await createEventBadgeSuggestions(
      client,
      ai,
      sectionId,
      termId,
      body,
    );

    if (body.eventId !== undefined) {
      return {
        status: 200,
        jsonBody:
          suggestions[0] ?? {
            eventName: "",
            eventDescription: "",
            possibleBadges: {},
          },
      };
    }

    return {
      status: 200,
      jsonBody: {
        date: body.date,
        events: suggestions,
      },
    };
  } catch (error) {
    if (error instanceof OsmRequestError) {
      return {
        status: error.status,
        jsonBody: {
          success: false,
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

