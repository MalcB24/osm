import type { HttpRequest } from "@azure/functions";

import type {
  Id,
  SuggestEventBadgesRequest,
} from "../models/index.js";
import {
  isRecord,
  parseOptionalDate,
} from "../utils/validation.js";

export async function parseSuggestEventBadgesRequest(
  request: HttpRequest,
): Promise<SuggestEventBadgesRequest> {
  const body = (await request.json()) as unknown;

  if (!isRecord(body)) {
    throw new Error("Request body must be a JSON object.");
  }

  const parsedBody: SuggestEventBadgesRequest = {
    date: parseOptionalDate(body.date),
  };

  readOptionalId(body, "eventId", (value) => {
    parsedBody.eventId = value;
  });

  if (!parsedBody.eventId && !parsedBody.date) {
    throw new Error('Supply either "eventId" or "date".');
  }

  if (typeof body.section === "string") {
    parsedBody.section = body.section;
  }

  readOptionalId(body, "typeId", (value) => {
    parsedBody.typeId = value;
  });
  readOptionalId(body, "payload", (value) => {
    parsedBody.payload = value;
  });
  readOptionalId(body, "memberId", (value) => {
    parsedBody.memberId = value;
  });

  if (typeof body.context === "string") {
    parsedBody.context = body.context;
  }

  return parsedBody;
}

function readOptionalId(
  body: Record<string, unknown>,
  name: string,
  setValue: (value: Id) => void,
): void {
  const value = body[name];

  if (typeof value === "string" || typeof value === "number") {
    setValue(value);
  }
}
