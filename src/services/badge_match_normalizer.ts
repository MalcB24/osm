import type {
  BadgeCandidate,
  BadgeMatchResponse,
  BadgeRequirement,
  EventBadgeLink,
  Id,
  SuggestedEventBadgesResponse,
} from "../models/index.js";
import { stripHtml } from "../utils/text.js";

export function normalizeBadgeMatches(
  aiResponse: BadgeMatchResponse,
  candidates: BadgeCandidate[],
  existingLinks: EventBadgeLink[],
): SuggestedEventBadgesResponse["possibleBadges"] {
  const possibleBadges: SuggestedEventBadgesResponse["possibleBadges"] =
    {};

  for (const badge of aiResponse.possibleBadges ?? []) {
    if (!badge.name && badge.badgeId === undefined) {
      continue;
    }

    const candidate = findBadgeCandidate(candidates, badge);
    const badgeId = badge.badgeId ?? candidate?.badgeId;
    const badgeVersion = badge.badgeVersion ?? candidate?.badgeVersion;
    const name =
      badge.name ?? candidate?.name ?? `Badge ${String(badgeId)}`;
    const key =
      badgeId === undefined
        ? name
        : `${String(badgeId)}:${String(badgeVersion ?? "")}`;

    possibleBadges[key] = {
      name,
      badgeId,
      badgeVersion,
      requirements: (badge.requirements ?? [])
        .filter((requirement) => requirement.name)
        .map((requirement) =>
          normalizeRequirementMatch(
            candidate,
            existingLinks,
            badgeId,
            badgeVersion,
            requirement,
          ),
        ),
    };
  }

  return possibleBadges;
}

function normalizeRequirementMatch(
  candidate: BadgeCandidate | undefined,
  existingLinks: EventBadgeLink[],
  badgeId: Id | undefined,
  badgeVersion: Id | undefined,
  requirement: {
    requirementId?: Id;
    name?: string;
    reason?: string;
  },
): SuggestedEventBadgesResponse["possibleBadges"][string]["requirements"][number] {
  const matchedRequirement = findRequirementCandidate(
    candidate,
    requirement,
  );
  const requirementId =
    requirement.requirementId ?? matchedRequirement?.requirement_id;
  const requirementName =
    matchedRequirement?.name ?? requirement.name ?? "";
  const requirementText = stripHtml(
    matchedRequirement?.tooltip ?? requirementName,
  );

  return {
    requirementId,
    name: requirementName,
    requirementText,
    reason: requirement.reason,
    alreadyLinked: isRequirementAlreadyLinked(
      existingLinks,
      badgeId,
      badgeVersion,
      requirementId,
      requirementName,
    ),
  };
}

function findBadgeCandidate(
  candidates: BadgeCandidate[],
  badge: {
    badgeId?: Id;
    badgeVersion?: Id;
    name?: string;
  },
): BadgeCandidate | undefined {
  return candidates.find((candidate) => {
    const idsMatch =
      badge.badgeId !== undefined &&
      idEquals(candidate.badgeId, badge.badgeId) &&
      (badge.badgeVersion === undefined ||
        idEquals(candidate.badgeVersion, badge.badgeVersion));

    return idsMatch || candidate.name === badge.name;
  });
}

function findRequirementCandidate(
  candidate: BadgeCandidate | undefined,
  requirement: {
    requirementId?: Id;
    name?: string;
  },
): BadgeRequirement | undefined {
  return candidate?.requirements.find((candidateRequirement) => {
    const idsMatch =
      requirement.requirementId !== undefined &&
      idEquals(
        candidateRequirement.requirement_id,
        requirement.requirementId,
      );

    return idsMatch || candidateRequirement.name === requirement.name;
  });
}

function isRequirementAlreadyLinked(
  existingLinks: EventBadgeLink[],
  badgeId: Id | undefined,
  badgeVersion: Id | undefined,
  requirementId: Id | undefined,
  requirementName: string,
): boolean {
  return existingLinks.some((link) => {
    const badgeMatches =
      badgeId !== undefined &&
      idEquals(link.badge_id, badgeId) &&
      (badgeVersion === undefined ||
        idEquals(link.badge_version, badgeVersion));

    if (!badgeMatches) {
      return false;
    }

    if (
      requirementId !== undefined &&
      idEquals(link.column_id, requirementId)
    ) {
      return true;
    }

    return [
      link.data,
      link.columnnameLongName,
      link.columnname,
    ].some(
      (value) =>
        typeof value === "string" &&
        value.toLowerCase().includes(requirementName.toLowerCase()),
    );
  });
}

function idEquals(left: Id, right: Id): boolean {
  return String(left) === String(right);
}
