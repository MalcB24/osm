import type { HttpRequest } from "@azure/functions";

import type {
  Id,
  SuggestGodBadgesRequest,
} from "../models/index.js";
import {
  getRequiredString,
  isRecord,
} from "../utils/validation.js";

export async function parseSuggestGodBadgesRequest(
  request: HttpRequest,
): Promise<SuggestGodBadgesRequest> {
  const body = (await request.json()) as unknown;

  if (!isRecord(body)) {
    throw new Error("Request body must be a JSON object.");
  }

  const parsedBody: SuggestGodBadgesRequest = {
    description: getRequiredString(body, "description"),
  };

  if (typeof body.name === "string") {
    parsedBody.name = body.name;
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
