import {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

import {
  OSMClient,
  OsmRequestError,
} from "../../clients/osm_client.js";
import type {
  MultipleBadgeRecordUpdate,
  SingleBadgeRecordUpdate,
} from "../../models/index.js";

interface BadgeRecordUpdateRequest {
  badgeId: string | number;
  badgeVersion: string | number;
  payload?: boolean | number | string;
  overwrite?: boolean;
  scoutId?: string | number;
  scoutIds?: Array<string | number>;
  field?: string | number;
  value?: string;
  values?: Record<string, string>;
  updates?: Array<{
    scoutId: string | number;
    values: Record<string, string>;
  }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isValidValueMap(
  value: unknown,
): value is Record<string, string> {
  return (
    isRecord(value) &&
    Object.keys(value).length > 0 &&
    Object.values(value).every(
      (fieldValue) => typeof fieldValue === "string",
    )
  );
}

function getRequiredBodyValue(
  body: Record<string, unknown>,
  name: string,
): string | number {
  const value = body[name];

  if (
    typeof value !== "string" &&
    typeof value !== "number"
  ) {
    throw new Error(`Missing or invalid "${name}".`);
  }

  return value;
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

async function getRequestBody(
  request: HttpRequest,
): Promise<BadgeRecordUpdateRequest> {
  const body = (await request.json()) as unknown;

  if (!isRecord(body)) {
    throw new Error("Request body must be a JSON object.");
  }

  const updateRequest: BadgeRecordUpdateRequest = {
    badgeId: getRequiredBodyValue(body, "badgeId"),
    badgeVersion: getRequiredBodyValue(body, "badgeVersion"),
  };

  if (
    body.payload !== undefined &&
    (typeof body.payload === "string" ||
      typeof body.payload === "number" ||
      typeof body.payload === "boolean")
  ) {
    updateRequest.payload = body.payload;
  }

  if (typeof body.overwrite === "boolean") {
    updateRequest.overwrite = body.overwrite;
  }

  if (
    typeof body.scoutId === "string" ||
    typeof body.scoutId === "number"
  ) {
    updateRequest.scoutId = body.scoutId;
  }

  if (
    Array.isArray(body.scoutIds) &&
    body.scoutIds.every(
      (id) => typeof id === "string" || typeof id === "number",
    )
  ) {
    updateRequest.scoutIds = body.scoutIds;
  }

  if (
    typeof body.field === "string" ||
    typeof body.field === "number"
  ) {
    updateRequest.field = body.field;
  }

  if (typeof body.value === "string") {
    updateRequest.value = body.value;
  }

  if (isValidValueMap(body.values)) {
    updateRequest.values = body.values;
  }

  if (Array.isArray(body.updates)) {
    updateRequest.updates = body.updates.map((update) => {
      if (!isRecord(update)) {
        throw new Error("Each update must be a JSON object.");
      }

      const scoutId = getRequiredBodyValue(update, "scoutId");

      if (!isValidValueMap(update.values)) {
        throw new Error(
          'Each update must include a non-empty "values" object.',
        );
      }

      return {
        scoutId,
        values: update.values,
      };
    });
  }

  return updateRequest;
}

function shouldUseMultipleRecords(
  body: BadgeRecordUpdateRequest,
): body is BadgeRecordUpdateRequest & {
  scoutIds: Array<string | number>;
  field: string | number;
  value: string;
} {
  return (
    Array.isArray(body.scoutIds) &&
    body.scoutIds.length > 1 &&
    body.field !== undefined &&
    body.value !== undefined
  );
}

function getSingleUpdates(
  body: BadgeRecordUpdateRequest,
  sectionId: string,
): SingleBadgeRecordUpdate[] {
  if (body.updates) {
    return body.updates.map((update) => ({
      scoutId: update.scoutId,
      badgeId: body.badgeId,
      badgeVersion: body.badgeVersion,
      sectionId,
      values: update.values,
      payload: body.payload,
    }));
  }

  if (body.scoutId !== undefined && body.values) {
    return [
      {
        scoutId: body.scoutId,
        badgeId: body.badgeId,
        badgeVersion: body.badgeVersion,
        sectionId,
        values: body.values,
        payload: body.payload,
      },
    ];
  }

  if (
    body.scoutIds &&
    body.field !== undefined &&
    body.value !== undefined
  ) {
    return body.scoutIds.map((scoutId) => ({
      scoutId,
      badgeId: body.badgeId,
      badgeVersion: body.badgeVersion,
      sectionId,
      values: { [String(body.field)]: body.value ?? "" },
      payload: body.payload,
    }));
  }

  throw new Error(
    'Provide either "scoutId" + "values", "updates", or "scoutIds" + "field" + "value".',
  );
}

export async function updateBadgeRecords(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const sectionId = getRequiredRouteParam(request, "sectionId");
  const termId = getRequiredRouteParam(request, "termId");
  let body: BadgeRecordUpdateRequest;

  try {
    body = await getRequestBody(request);
  } catch (error) {
    return {
      status: 400,
      body:
        error instanceof Error
          ? error.message
          : "Invalid badge update request.",
    };
  }

  context.log(
    `Updating badge "${body.badgeId}" version "${body.badgeVersion}" in section "${sectionId}" term "${termId}".`,
  );

  const client = await OSMClient.create();

  try {
    if (shouldUseMultipleRecords(body)) {
      const update: MultipleBadgeRecordUpdate = {
        scoutIds: body.scoutIds,
        badgeId: body.badgeId,
        badgeVersion: body.badgeVersion,
        sectionId,
        field: body.field,
        value: body.value,
        overwrite: body.overwrite ?? true,
        payload: body.payload,
      };

      return {
        status: 200,
        jsonBody: {
          mode: "multiple",
          result: await client.updateMultipleBadgeRecords(update),
        },
      };
    }

    const results = [];

    for (const update of getSingleUpdates(body, sectionId)) {
      results.push(await client.updateSingleBadgeRecord(update));
    }

    return {
      status: 200,
      jsonBody: {
        mode: "single",
        results,
      },
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

