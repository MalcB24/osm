import {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

import { createOsmClientForRequest } from "../../utils/http.js";

import { OsmRequestError } from "../../clients/osm_client.js";
import type { SuggestGodBadgesRequest } from "../../models/index.js";
import { parseSuggestGodBadgesRequest } from "../../requests/suggest_god_badges_request.js";
import { AzureOpenAIService } from "../../services/azure_openai_service.js";
import { createGodBadgeSuggestion } from "../../services/event_badge_suggestion_service.js";
import {
  badRequest,
  getRequiredRouteParam,
} from "../../utils/http.js";

export async function suggestGodBadges(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const sectionId = getRequiredRouteParam(request, "sectionId");
  const termId = getRequiredRouteParam(request, "termId");
  let body: SuggestGodBadgesRequest;

  try {
    body = await parseSuggestGodBadgesRequest(request);
  } catch (error) {
    return badRequest(error, "Invalid god badge suggestion request.");
  }

  context.log(
    `Suggesting god badge matches for section "${sectionId}" term "${termId}".`,
  );

  const client = await createOsmClientForRequest(request);

  try {
    const ai = await AzureOpenAIService.create();

    return {
      status: 200,
      jsonBody: await createGodBadgeSuggestion(
        client,
        ai,
        sectionId,
        termId,
        body,
      ),
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
