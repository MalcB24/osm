import {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

import { OSMClient } from "../../clients/osm_client.js";
import type { OsmEvent } from "../../models/index.js";

interface EventFilters {
  future?: boolean;
  past?: boolean;
  from?: string;
  to?: string;
  onDate?: string;
  name?: string;
  location?: string;
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

function parseBoolean(value: string | null): boolean | undefined {
  if (value === null) {
    return undefined;
  }

  const normalizedValue = value.toLowerCase();

  if (["1", "true", "yes", "y"].includes(normalizedValue)) {
    return true;
  }

  if (["0", "false", "no", "n"].includes(normalizedValue)) {
    return false;
  }

  throw new Error(`Invalid boolean query parameter value "${value}".`);
}

function parseDateOnly(value: string | null): string | undefined {
  if (value === null || value === "") {
    return undefined;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  throw new Error(
    `Invalid date "${value}". Expected YYYY-MM-DD.`,
  );
}

function getTodayDateOnly(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getEventDate(event: OsmEvent): string | undefined {
  if (event.startdate_g) {
    return event.startdate_g;
  }

  if (event.date) {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(
      event.date,
    );

    if (match) {
      const [, day, month, year] = match;
      return `${year}-${month}-${day}`;
    }
  }

  return undefined;
}

function getEventFilters(request: HttpRequest): EventFilters {
  return {
    future: parseBoolean(request.query.get("future")),
    past: parseBoolean(request.query.get("past")),
    from: parseDateOnly(
      request.query.get("from") ??
        request.query.get("dateFrom"),
    ),
    to: parseDateOnly(
      request.query.get("to") ?? request.query.get("dateTo"),
    ),
    onDate: parseDateOnly(request.query.get("onDate")),
    name: request.query.get("name") ?? undefined,
    location: request.query.get("location") ?? undefined,
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

function applyEventFilters(
  events: OsmEvent[],
  filters: EventFilters,
): OsmEvent[] {
  const today = getTodayDateOnly();

  return events.filter((event) => {
    const eventDate = getEventDate(event);

    if (!includesText(event.name, filters.name)) {
      return false;
    }

    if (!includesText(event.location, filters.location)) {
      return false;
    }

    if (!eventDate) {
      return false;
    }

    if (filters.onDate && eventDate !== filters.onDate) {
      return false;
    }

    if (filters.from && eventDate < filters.from) {
      return false;
    }

    if (filters.to && eventDate > filters.to) {
      return false;
    }

    if (
      filters.future === true &&
      filters.past !== true &&
      eventDate < today
    ) {
      return false;
    }

    if (
      filters.past === true &&
      filters.future !== true &&
      eventDate >= today
    ) {
      return false;
    }

    return true;
  });
}

export async function getEvents(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const sectionId = getRequiredRouteParam(request, "sectionId");
  const termId = getRequiredRouteParam(request, "termId");
  let filters: EventFilters;

  try {
    filters = getEventFilters(request);
  } catch (error) {
    return {
      status: 400,
      body:
        error instanceof Error
          ? error.message
          : "Invalid event filter.",
    };
  }

  context.log(
    `Getting events for section "${sectionId}" term "${termId}".`,
  );

  const client = await OSMClient.create();

  try {
    const events = applyEventFilters(
      await client.getEvents(sectionId, termId),
      filters,
    );

    return {
      status: 200,
      jsonBody: events,
    };
  } finally {
    await client.close();
  }
}

