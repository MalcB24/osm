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
import type { ActualAttendanceMember } from "../../models/index.js";
import {
  ActualAttendanceFilters,
  createActualAttendanceFilters,
  getActualAttendanceResult,
} from "../../services/actual_attendance_service.js";

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

function getFilters(request: HttpRequest): ActualAttendanceFilters {
  return createActualAttendanceFilters({
    date:
      request.query.get("date") ??
      request.query.get("onDate") ??
      undefined,
    scoutId: request.query.get("scoutId") ?? undefined,
    scoutIds: request.query.get("scoutIds") ?? undefined,
    scoutName:
      request.query.get("scoutName") ??
      request.query.get("name") ??
      undefined,
    patrol: request.query.get("patrol") ?? undefined,
  });
}

export async function getActualAttendance(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const sectionId = getRequiredRouteParam(request, "sectionId");
  const termId = getRequiredRouteParam(request, "termId");
  let filters: ActualAttendanceFilters;

  try {
    filters = getFilters(request);
  } catch (error) {
    return {
      status: 400,
      body:
        error instanceof Error
          ? error.message
          : "Invalid attendance filter.",
    };
  }

  context.log(
    `Getting actual attendance for section "${sectionId}" term "${termId}".`,
  );

  const client = await createOsmClientForRequest(request);

  try {
    let scouts: ActualAttendanceMember[];

    try {
      scouts = await client.getActualAttendance(sectionId, termId, {
        section: request.query.get("section") ?? undefined,
      });
    } catch (error) {
      if (error instanceof OsmRequestError) {
        return {
          status: error.status,
          jsonBody: {
            error: error.message,
            details:
              error.status === 403
                ? "OSM refused the attendance register request. Re-authorize the app so the stored token includes the attendance scope, and confirm the OSM user has access to this section and term."
                : error.body,
          },
        };
      }

      throw error;
    }

    return {
      status: 200,
      jsonBody: getActualAttendanceResult(scouts, filters),
    };
  } finally {
    await client.close();
  }
}
