import type { Id } from "../models/index.js";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

export function getRequiredId(
  body: Record<string, unknown>,
  name: string,
): Id {
  const value = body[name];

  if (typeof value !== "string" && typeof value !== "number") {
    throw new Error(`Missing or invalid "${name}".`);
  }

  return value;
}

export function getRequiredString(
  body: Record<string, unknown>,
  name: string,
): string {
  const value = body[name];

  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing or invalid "${name}".`);
  }

  return value;
}

export function parseOptionalDate(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Invalid "date". Expected YYYY-MM-DD.');
  }

  return value;
}
