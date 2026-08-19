import {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

import {
  createOsmClientForRequest,
  getRequiredRouteParam,
} from "../../utils/http.js";

export async function getBadgesByMember(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const sectionId = getRequiredRouteParam(request, "sectionId");
  const termId = getRequiredRouteParam(request, "termId");

  context.log(
    `Getting badges by member for section "${sectionId}" term "${termId}".`,
  );

  const client = await createOsmClientForRequest(request);

  try {
    const badgesByMember = await client.getBadgesByMember(
      sectionId,
      termId,
      {
        section: request.query.get("section") ?? undefined,
      },
    );

    return {
      status: 200,
      jsonBody: badgesByMember,
    };
  } finally {
    await client.close();
  }
}
