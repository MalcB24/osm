import {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

import { createOsmClientForRequest } from "../../utils/http.js";

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

export async function getMarkedAttendance(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const sectionId = getRequiredRouteParam(request, "sectionId");
  const termId = getRequiredRouteParam(request, "termId");
  const eventId = getRequiredRouteParam(request, "eventId");

  context.log(
    `Getting marked attendance for event "${eventId}" in section "${sectionId}" term "${termId}".`,
  );

  const client = await createOsmClientForRequest(request);

  try {
    const attendance = await client.getMarkedAttendance(
      sectionId,
      termId,
      eventId,
      {
        mode: request.query.get("mode") ?? undefined,
      },
    );

    return {
      status: 200,
      jsonBody: attendance,
    };
  } finally {
    await client.close();
  }
}
