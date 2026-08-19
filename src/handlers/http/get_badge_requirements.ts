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

export async function getBadgeRequirements(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const sectionId = getRequiredRouteParam(request, "sectionId");
  const termId = getRequiredRouteParam(request, "termId");
  const badgeId = getRequiredRouteParam(request, "badgeId");
  const badgeVersion = getRequiredRouteParam(
    request,
    "badgeVersion",
  );

  context.log(
    `Getting requirements for badge "${badgeId}" version "${badgeVersion}" in section "${sectionId}" term "${termId}".`,
  );

  const client = await createOsmClientForRequest(request);

  try {
    const requirements = await client.getBadgeRequirements(
      sectionId,
      termId,
      badgeId,
      badgeVersion,
      {
        section: request.query.get("section") ?? undefined,
        payload: request.query.get("payload") ?? undefined,
        typeId: request.query.get("typeId") ?? undefined,
      },
    );

    return {
      status: 200,
      jsonBody: requirements,
    };
  } finally {
    await client.close();
  }
}

