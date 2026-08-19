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

function getRequiredRouteParam(
  request: HttpRequest,
  name: string,
): string {
  const value = request.params[name];

  if (!value) {
    throw new Error(`Missing route parameter "${name}".`);
  }

  return value;
}

export async function getEvent(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const sectionId = getRequiredRouteParam(request, "sectionId");
  const eventId = getRequiredRouteParam(request, "eventId");

  context.log(
    `Getting event "${eventId}" for section "${sectionId}".`,
  );

  const client = await createOsmClientForRequest(request);

  try {
    const event = await client.getEvent(sectionId, eventId);

    return {
      status: 200,
      jsonBody: event,
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

