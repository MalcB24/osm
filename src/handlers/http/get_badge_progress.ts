import {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

import { getBadgeProgress as shapeBadgeProgress } from "../../services/badge_progress_service.js";
import {
  createOsmClientForRequest,
  getRequiredRouteParam,
} from "../../utils/http.js";

export async function getBadgeProgress(
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
    `Getting progress for badge "${badgeId}" version "${badgeVersion}" in section "${sectionId}" term "${termId}".`,
  );

  const client = await createOsmClientForRequest(request);

  try {
    const records = await client.getBadgeRecords(
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
      jsonBody: shapeBadgeProgress(records),
    };
  } finally {
    await client.close();
  }
}
