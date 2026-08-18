import type {
  ActualAttendanceDate,
  ActualAttendanceEntry,
  ActualAttendanceMember,
  ActualAttendanceResult,
} from "../models/index.js";

export interface ActualAttendanceFilters {
  date?: string;
  scoutIds: Set<string>;
  scoutName?: string;
  patrol?: string;
}

export function parseAttendanceDate(
  value: string | undefined,
): string | undefined {
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

export function createActualAttendanceFilters(options: {
  date?: string;
  scoutId?: string;
  scoutIds?: string;
  scoutName?: string;
  patrol?: string;
}): ActualAttendanceFilters {
  const scoutIds = new Set<string>();

  if (options.scoutId) {
    scoutIds.add(options.scoutId);
  }

  if (options.scoutIds) {
    for (const id of options.scoutIds.split(",")) {
      const trimmedId = id.trim();

      if (trimmedId) {
        scoutIds.add(trimmedId);
      }
    }
  }

  return {
    date: parseAttendanceDate(options.date),
    scoutIds,
    scoutName: options.scoutName,
    patrol: options.patrol,
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

export function getActualAttendanceResult(
  scouts: ActualAttendanceMember[],
  filters: ActualAttendanceFilters,
): ActualAttendanceResult {
  const availableDates = getAttendanceDates(scouts);
  const filteredScouts = filterScouts(scouts, filters);
  const dates = filters.date ? [filters.date] : availableDates;

  return {
    availableDates,
    dates: dates.map((date) =>
      getDateGroup(date, filteredScouts),
    ),
  };
}
