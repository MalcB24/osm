import type { OSMClient } from "../clients/osm_client.js";
import type {
  BadgeCandidate,
  BadgeMatchResponse,
  OsmEventDetails,
  SuggestedEventBadgesResponse,
  SuggestEventBadgesRequest,
} from "../models/index.js";
import { normalizeBadgeMatches } from "./badge_match_normalizer.js";
import { loadBadgeCandidates } from "./badge_candidate_service.js";
import {
  getEventDescription,
  getEventsForSuggestionRequest,
} from "./osm_event_lookup_service.js";
import type { AzureOpenAIService } from "./azure_openai_service.js";

export async function createEventBadgeSuggestions(
  client: OSMClient,
  ai: AzureOpenAIService,
  sectionId: string,
  termId: string,
  body: SuggestEventBadgesRequest,
): Promise<SuggestedEventBadgesResponse[]> {
  const [events, candidates] = await Promise.all([
    getEventsForSuggestionRequest(client, sectionId, termId, body),
    loadBadgeCandidates(client, sectionId, termId, body),
  ]);

  const suggestions: SuggestedEventBadgesResponse[] = [];

  for (const event of events) {
    suggestions.push(
      await suggestBadgesForEvent(ai, event, candidates),
    );
  }

  return suggestions;
}

async function suggestBadgesForEvent(
  ai: AzureOpenAIService,
  event: OsmEventDetails,
  candidates: BadgeCandidate[],
): Promise<SuggestedEventBadgesResponse> {
  const eventDescription = getEventDescription(event);
  const aiResponse = await ai.getJsonCompletion<BadgeMatchResponse>(
    [
      {
        role: "system",
        content:
          "You match Scout event descriptions to badge requirements. " +
          "Only suggest requirements that are plausibly evidenced by the event. " +
          "Use only badge and requirement IDs from the provided JSON. " +
          "Return JSON only, shaped as {\"possibleBadges\":[{\"badgeId\":...,\"badgeVersion\":...,\"name\":\"...\",\"requirements\":[{\"requirementId\":...,\"name\":\"...\",\"reason\":\"...\"}]}]}. " +
          "If there are no meaningful matches, return {\"possibleBadges\":[]}.",
      },
      {
        role: "user",
        content: JSON.stringify({
          event: {
            name: event.name,
            description: eventDescription,
          },
          badges: createBadgePromptPayload(candidates),
        }),
      },
    ],
    {
      maxTokens: 3500,
      temperature: 0.1,
    },
  );

  return {
    eventName: event.name,
    eventId: event.eventid,
    eventDescription,
    possibleBadges: normalizeBadgeMatches(
      aiResponse,
      candidates,
      event.badgelinks ?? [],
    ),
  };
}

function createBadgePromptPayload(
  candidates: BadgeCandidate[],
): Array<Record<string, unknown>> {
  return candidates.map((badge) => ({
    badgeId: badge.badgeId,
    badgeVersion: badge.badgeVersion,
    name: badge.name,
    requirements: badge.requirements.map((requirement) => ({
      requirementId: requirement.requirement_id,
      name: requirement.name,
      requirementText: requirement.tooltip,
      tooltip: requirement.tooltip,
      module: requirement.module,
      points: requirement.points,
    })),
  }));
}
