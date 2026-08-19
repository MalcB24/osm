import type {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

import { OSMClient } from "../clients/osm_client.js";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function getRequiredRouteParam(
  request: HttpRequest,
  name: string,
): string {
  const value = request.params[name];

  if (!value) {
    throw new Error(`Missing route parameter "${name}".`);
  }

  return value;
}

export function badRequest(
  error: unknown,
  fallbackMessage: string,
): HttpResponseInit {
  return {
    status: 400,
    body: error instanceof Error ? error.message : fallbackMessage,
  };
}

export function getBearerToken(
  request: HttpRequest,
): string | undefined {
  const authorization = request.headers.get("authorization");

  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return undefined;
  }

  return authorization.slice("bearer ".length).trim();
}

export async function createOsmClientForRequest(
  request: HttpRequest,
): Promise<OSMClient> {
  const bearerToken = getBearerToken(request);

  if (!bearerToken) {
    throw new HttpError(401, "Missing Authorization bearer token.");
  }

  return OSMClient.createWithAccessToken(bearerToken);
}

export function httpErrorResponse(error: unknown): HttpResponseInit | undefined {
  if (!(error instanceof HttpError)) {
    return undefined;
  }

  return {
    status: error.status,
    jsonBody: {
      error: error.message,
    },
  };
}

export function withHttpErrors(
  handler: (
    request: HttpRequest,
    context: InvocationContext,
  ) => Promise<HttpResponseInit>,
): (
  request: HttpRequest,
  context: InvocationContext,
) => Promise<HttpResponseInit> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      const response = httpErrorResponse(error);

      if (response) {
        return response;
      }

      throw error;
    }
  };
}
