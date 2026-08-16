import type { BadgeRequirement } from "./osm_badge.js";
import type { Id } from "./id.js";

export interface SuggestEventBadgesRequest {
  date?: string;
  eventId?: Id;
  section?: string;
  typeId?: Id;
  payload?: Id;
  context?: string;
  memberId?: Id;
}

export interface BadgeCandidate {
  badgeId: Id;
  badgeVersion: Id;
  name: string;
  requirements: BadgeRequirement[];
}

export interface BadgeMatchResponse {
  possibleBadges?: Array<{
    badgeId?: Id;
    badgeVersion?: Id;
    name?: string;
    requirements?: Array<{
      requirementId?: Id;
      name?: string;
      reason?: string;
    }>;
  }>;
}

export interface SuggestedEventBadgesResponse {
  eventName: string;
  eventId: Id;
  eventDescription: string;
  possibleBadges: Record<
    string,
    {
      name: string;
      badgeId?: Id;
      badgeVersion?: Id;
      requirements: Array<{
        requirementId?: Id;
        name: string;
        requirementText: string;
        reason?: string;
        alreadyLinked: boolean;
      }>;
    }
  >;
}
