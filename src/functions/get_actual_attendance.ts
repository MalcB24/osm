import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

import {
  OSMClient,
  OsmRequestError,
} from "../clients/osm_client.js";
import type {
  ActualAttendanceDate,
  ActualAttendanceEntry,
  ActualAttendanceMember,
  ActualAttendanceResult,
} from "../models/index.js";

interface ActualAttendanceFilters {
  date?: string;
  scoutIds: Set<string>;
  scoutName?: string;
  patrol?: string;
}

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

function parseDate(value: string | null): string | undefined {
  if (!value) {
    return undefined;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(
      `Invalid date "${value}". Expected YYYY-MM-DD.`,
    );
  }

  return value;
}

function parseScoutIds(request: HttpRequest): Set<string> {
  const scoutIds = new Set<string>();
  const scoutId = request.query.get("scoutId");
  const scoutIdsValue = request.query.get("scoutIds");

  if (scoutId) {
    scoutIds.add(scoutId);
  }

  if (scoutIdsValue) {
    for (const id of scoutIdsValue.split(",")) {
      const trimmedId = id.trim();

      if (trimmedId) {
        scoutIds.add(trimmedId);
      }
    }
  }

  return scoutIds;
}

function getFilters(request: HttpRequest): ActualAttendanceFilters {
  return {
    date: parseDate(
      request.query.get("date") ?? request.query.get("onDate"),
    ),
    scoutIds: parseScoutIds(request),
    scoutName:
      request.query.get("scoutName") ??
      request.query.get("name") ??
      undefined,
    patrol: request.query.get("patrol") ?? undefined,
  };
}

function includesText(
  value: string | undefined,
  search: string | undefined,
): boolean {
  if (!search) {
    return true;
  }

  return (value ?? "")
    .toLowerCase()
    .includes(search.toLowerCase());
}

function filterScouts(
  scouts: ActualAttendanceMember[],
  filters: ActualAttendanceFilters,
): ActualAttendanceMember[] {
  return scouts.filter((scout) => {
    if (
      filters.scoutIds.size > 0 &&
      !filters.scoutIds.has(String(scout.scoutid))
    ) {
      return false;
    }

    if (
      !includesText(
        `${scout.firstname} ${scout.lastname}`,
        filters.scoutName,
      )
    ) {
      return false;
    }

    if (!includesText(scout.patrol, filters.patrol)) {
      return false;
    }

    return true;
  });
}

function getAttendanceDates(
  scouts: ActualAttendanceMember[],
): string[] {
  const dates = new Set<string>();

  for (const scout of scouts) {
    for (const [key, value] of Object.entries(scout)) {
      if (
        /^\d{4}-\d{2}-\d{2}$/.test(key) &&
        (value === "Yes" || value === "No")
      ) {
        dates.add(key);
      }
    }
  }

  return [...dates].sort();
}

function getAttendanceEntry(
  scout: ActualAttendanceMember,
  date: string,
): ActualAttendanceEntry {
  const value = scout[date];
  const attendance =
    value === "Yes" || value === "No" ? value : "Unknown";

  return {
    scoutid: scout.scoutid,
    firstname: scout.firstname,
    lastname: scout.lastname,
    full_name: `${scout.firstname} ${scout.lastname}`,
    patrol: scout.patrol,
    attendance,
    attended: attendance === "Yes",
    responded: attendance !== "Unknown",
  };
}

function getDateGroup(
  date: string,
  scouts: ActualAttendanceMember[],
): ActualAttendanceDate {
  const entries = scouts.map((scout) =>
    getAttendanceEntry(scout, date),
  );

  return {
    date,
    entries,
    totals: {
      yes: entries.filter((entry) => entry.attendance === "Yes")
        .length,
      no: entries.filter((entry) => entry.attendance === "No")
        .length,
      unknown: entries.filter(
        (entry) => entry.attendance === "Unknown",
      ).length,
    },
  };
}

function getActualAttendanceResult(
  allScouts: ActualAttendanceMember[],
  filteredScouts: ActualAttendanceMember[],
  filters: ActualAttendanceFilters,
): ActualAttendanceResult {
  const availableDates = getAttendanceDates(allScouts);
  const dates = filters.date ? [filters.date] : availableDates;

  return {
    availableDates,
    dates: dates.map((date) =>
      getDateGroup(date, filteredScouts),
    ),
  };
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

  const client = await OSMClient.create();

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
      jsonBody: getActualAttendanceResult(
        scouts,
        filterScouts(scouts, filters),
        filters,
      ),
    };
  } finally {
    await client.close();
  }
}

app.http("get_actual_attendance", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "sections/{sectionId}/terms/{termId}/actual-attendance",
  handler: getActualAttendance,
});
