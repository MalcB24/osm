import type { OSMClient } from "../clients/osm_client.js";
import type {
  BadgeCandidate,
  BadgeMatchResponse,
  OsmEventDetails,
  SuggestedDescriptionBadgesResponse,
  SuggestedEventBadgesResponse,
  SuggestGodBadgesRequest,
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

export async function createGodBadgeSuggestion(
  client: OSMClient,
  ai: AzureOpenAIService,
  sectionId: string,
  termId: string,
  body: SuggestGodBadgesRequest,
): Promise<SuggestedDescriptionBadgesResponse> {
  const candidates = filterGodBadgeCandidates(
    await loadBadgeCandidates(client, sectionId, termId, body),
  );

  return suggestBadgesForDescription(
    ai,
    {
      name: body.name ?? "Manual description",
      description: body.description,
    },
    candidates,
  );
}

async function suggestBadgesForEvent(
  ai: AzureOpenAIService,
  event: OsmEventDetails,
  candidates: BadgeCandidate[],
): Promise<SuggestedEventBadgesResponse> {
  const eventDescription = getEventDescription(event);
  const aiResponse = await getBadgeSuggestionResponse(ai, {
    name: event.name,
    description: eventDescription,
    candidates,
  });

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

async function suggestBadgesForDescription(
  ai: AzureOpenAIService,
  descriptionInput: {
    name: string;
    description: string;
  },
  candidates: BadgeCandidate[],
): Promise<SuggestedDescriptionBadgesResponse> {
  const aiResponse = await getBadgeSuggestionResponse(ai, {
    ...descriptionInput,
    candidates,
  });

  return {
    name: descriptionInput.name,
    description: descriptionInput.description,
    possibleBadges: normalizeBadgeMatches(aiResponse, candidates, []),
  };
}

async function getBadgeSuggestionResponse(
  ai: AzureOpenAIService,
  input: {
    name: string;
    description: string;
    candidates: BadgeCandidate[];
  },
): Promise<BadgeMatchResponse> {
  return ai.getJsonCompletion<BadgeMatchResponse>(
    [
      {
        role: "system",
        content: getBadgeSuggestionSystemPrompt(),
      },
      {
        role: "user",
        content: JSON.stringify({
          event: {
            name: input.name,
            description: input.description,
          },
          badges: createBadgePromptPayload(input.candidates),
        }),
      },
    ],
    {
      maxTokens: 3500,
      temperature: 0.1,
    },
  );
}

function getBadgeSuggestionSystemPrompt(): string {
  return (
    "You match Scout event descriptions to badge requirements. " +
    "Only suggest requirements that are plausibly evidenced by the event. " +
    "Use only badge and requirement IDs from the provided JSON. " +
    "Return JSON only, shaped as {\"possibleBadges\":[{\"badgeId\":...,\"badgeVersion\":...,\"name\":\"...\",\"requirements\":[{\"requirementId\":...,\"name\":\"...\",\"reason\":\"...\"}]}]}. " +
    "If there are no meaningful matches, return {\"possibleBadges\":[]}."
  );
}

function filterGodBadgeCandidates(
  candidates: BadgeCandidate[],
): BadgeCandidate[] {
  return candidates.filter((candidate) =>
    (candidate.groupName ?? "")
      .toLowerCase()
      .includes("olympian missions"),
  );
}

function createBadgePromptPayload(
  candidates: BadgeCandidate[],
): Array<Record<string, unknown>> {
  return candidates.map((badge) => ({
    badgeId: badge.badgeId,
    badgeVersion: badge.badgeVersion,
    name: badge.name,
    groupName: badge.groupName,
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
