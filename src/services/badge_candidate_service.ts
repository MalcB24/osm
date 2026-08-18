import type { OSMClient } from "../clients/osm_client.js";
import type {
  BadgeCandidate,
  Id,
  SuggestGodBadgesRequest,
  SuggestEventBadgesRequest,
} from "../models/index.js";
import { isRecord } from "../utils/validation.js";

interface AvailableBadgeCandidate {
  badgeId: Id;
  badgeVersion: Id;
  name: string;
  groupName?: string;
}

export async function loadBadgeCandidates(
  client: OSMClient,
  sectionId: string,
  termId: string,
  body: SuggestEventBadgesRequest | SuggestGodBadgesRequest,
): Promise<BadgeCandidate[]> {
  const rawBadges = (await client.getAvailableBadges(sectionId, {
    section: body.section,
    typeId: body.typeId,
    payload: body.payload,
    context: body.context,
    memberId: body.memberId,
  })) as unknown;

  const availableBadges = normalizeAvailableBadges(rawBadges);
  const candidates: BadgeCandidate[] = [];

  for (const badge of availableBadges) {
    const requirements = await client.getBadgeRequirements(
      sectionId,
      termId,
      badge.badgeId,
      badge.badgeVersion,
      {
        section: body.section,
        payload: body.payload,
        typeId: body.typeId,
      },
    );

    if (requirements.length > 0) {
      candidates.push({
        ...badge,
        requirements,
      });
    }
  }

  return candidates;
}

function normalizeAvailableBadges(
  rawBadges: unknown,
): AvailableBadgeCandidate[] {
  return collectArrayValues(rawBadges)
    .filter(isRecord)
    .map((badge): AvailableBadgeCandidate | undefined => {
      const badgeId = getIdField(badge, ["badge_id", "badgeId", "id"]);
      const badgeVersion = getIdField(badge, [
        "badge_version",
        "badgeVersion",
        "version",
      ]);
      const name =
        typeof badge.name === "string"
          ? badge.name
          : typeof badge.badgeLongName === "string"
            ? badge.badgeLongName
            : `Badge ${String(badgeId)}`;
      const groupName =
        typeof badge.group_name === "string"
          ? badge.group_name
          : typeof badge.badge_group === "string"
            ? badge.badge_group
            : undefined;

      if (badgeId === undefined || badgeVersion === undefined) {
        return undefined;
      }

      return {
        badgeId,
        badgeVersion,
        name,
        groupName,
      };
    })
    .filter(
      (badge): badge is AvailableBadgeCandidate =>
        badge !== undefined,
    );
}

function collectArrayValues(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (!isRecord(value)) {
    return [];
  }

  if (
    getIdField(value, ["badge_id", "badgeId", "id"]) !== undefined &&
    getIdField(value, [
      "badge_version",
      "badgeVersion",
      "version",
    ]) !== undefined
  ) {
    return [value];
  }

  for (const key of ["items", "data", "badges", "availableBadges"]) {
    const nested = value[key];

    if (Array.isArray(nested)) {
      return nested;
    }

    if (isRecord(nested)) {
      const nestedValues = Object.values(nested).flatMap(
        collectArrayValues,
      );

      if (nestedValues.length > 0) {
        return nestedValues;
      }
    }
  }

  return Object.values(value).flatMap(collectArrayValues);
}

function getIdField(
  value: Record<string, unknown>,
  keys: string[],
): Id | undefined {
  for (const key of keys) {
    const field = value[key];

    if (typeof field === "string" || typeof field === "number") {
      return field;
    }
  }

  return undefined;
}
