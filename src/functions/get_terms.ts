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
import type { SectionTerm } from "../models/index.js";

interface TermFilters {
  current?: boolean;
  past?: boolean;
  future?: boolean;
  onDate?: string;
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

  throw new Error(`Invalid boolean value "${value}".`);
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

function getTodayDateOnly(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getFilters(request: HttpRequest): TermFilters {
  return {
    current: parseBoolean(request.query.get("current")),
    past: parseBoolean(request.query.get("past")),
    future: parseBoolean(request.query.get("future")),
    onDate: parseDate(
      request.query.get("onDate") ?? request.query.get("date"),
    ),
  };
}

function includesDate(term: SectionTerm, date: string): boolean {
  return term.startdate <= date && term.enddate >= date;
}

function applyFilters(
  terms: SectionTerm[],
  filters: TermFilters,
): SectionTerm[] {
  const today = getTodayDateOnly();

  return terms.filter((term) => {
    if (filters.current === true && !includesDate(term, today)) {
      return false;
    }

    if (filters.past === true && !term.past) {
      return false;
    }

    if (filters.future === true && term.past) {
      return false;
    }

    if (
      filters.onDate &&
      !includesDate(term, filters.onDate)
    ) {
      return false;
    }

    return true;
  });
}

export async function getTerms(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const sectionId = getRequiredRouteParam(request, "sectionId");
  let filters: TermFilters;

  try {
    filters = getFilters(request);
  } catch (error) {
    return {
      status: 400,
      body:
        error instanceof Error
          ? error.message
          : "Invalid terms filter.",
    };
  }

  context.log(`Getting terms for section "${sectionId}".`);

  const client = await OSMClient.create();

  try {
    const terms = await client.getTerms(sectionId);

    return {
      status: 200,
      jsonBody: applyFilters(terms, filters),
    };
  } catch (error) {
    if (error instanceof OsmRequestError) {
      return {
        status: error.status,
        jsonBody: {
          error: error.message,
          details: error.body,
        },
      };
    }

    throw error;
  } finally {
    await client.close();
  }
}

app.http("get_terms", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "sections/{sectionId}/terms",
  handler: getTerms,
});
