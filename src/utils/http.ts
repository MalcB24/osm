import type { HttpRequest, HttpResponseInit } from "@azure/functions";

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
