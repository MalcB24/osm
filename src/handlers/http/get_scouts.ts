import {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

import { createOsmClientForRequest } from "../../utils/http.js";

import { OSMClient } from "../../clients/osm_client.js";

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

export async function getScouts(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const sectionId = getRequiredRouteParam(request, "sectionId");
  const termId = getRequiredRouteParam(request, "termId");

  context.log(
    `Getting scouts for section "${sectionId}" term "${termId}".`,
  );

  const client = await createOsmClientForRequest(request);

  try {
    const scouts = await client.getScouts(sectionId, termId, {
      section: request.query.get("section") ?? undefined,
      sort: request.query.get("sort") ?? undefined,
    });

    return {
      status: 200,
      jsonBody: scouts,
    };
  } finally {
    await client.close();
  }
}

