import type { HttpRequest } from "@azure/functions";

import type { Id } from "../models/index.js";
import {
  getRequiredId,
  getRequiredString,
  isRecord,
} from "../utils/validation.js";

export interface LinkEventBadgeRequest {
  badgeId: Id;
  badgeVersion: Id;
  // picture: string;
  columnId: Id;
  columnData: string;
  section?: string;
  newColumnName?: string;
}

export async function parseLinkEventBadgeRequest(
  request: HttpRequest,
): Promise<LinkEventBadgeRequest> {
  const body = (await request.json()) as unknown;

  if (!isRecord(body)) {
    throw new Error("Request body must be a JSON object.");
  }

  const linkRequest: LinkEventBadgeRequest = {
    badgeId: getRequiredId(body, "badgeId"),
    badgeVersion: getRequiredId(body, "badgeVersion"),
    columnId: getRequiredId(body, "columnId"),
    columnData: getRequiredString(body, "columnData"),
  };

  if (typeof body.section === "string") {
    linkRequest.section = body.section;
  }

  if (typeof body.newColumnName === "string") {
    linkRequest.newColumnName = body.newColumnName;
  }

  return linkRequest;
}
