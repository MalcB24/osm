import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

import { OSMClient } from "../clients/osm_client.js";

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

export async function getAvailableBadges(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const sectionId = getRequiredRouteParam(request, "sectionId");
  
  context.log(
    `Getting available badges for section ID "${sectionId}".`,
  );

  const client = await OSMClient.create();

  try {
    const badges = await client.getAvailableBadges(sectionId, {
      section: request.query.get("section") ?? undefined,
      typeId: request.query.get("typeId") ?? undefined,
      payload: request.query.get("payload") ?? undefined,
      context: request.query.get("context") ?? undefined,
      memberId: request.query.get("memberId") ?? undefined,
    });

    return {
      status: 200,
      jsonBody: badges,
    };
  } finally {
    await client.close();
  }
}

app.http("get_available_badges", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "sections/{sectionId}/available-badges",
  handler: getAvailableBadges,
});
