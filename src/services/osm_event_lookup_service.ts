import type { OSMClient } from "../clients/osm_client.js";
import type {
  OsmEvent,
  OsmEventDetails,
  SuggestEventBadgesRequest,
} from "../models/index.js";
import { stripHtml } from "../utils/text.js";

export async function getEventsForSuggestionRequest(
  client: OSMClient,
  sectionId: string,
  termId: string,
  body: SuggestEventBadgesRequest,
): Promise<OsmEventDetails[]> {
  if (body.eventId !== undefined) {
    return [await client.getEvent(sectionId, body.eventId)];
  }

  const events = await client.getEvents(sectionId, termId);
  const eventsOnDate = events.filter(
    (event) => getEventDate(event) === body.date,
  );

  return Promise.all(
    eventsOnDate.map((event) =>
      client.getEvent(sectionId, event.eventid),
    ),
  );
}

export function getEventDescription(event: OsmEventDetails): string {
  return stripHtml(
    [
      event.notepad,
      event.notes,
      event.publicnotes,
      event.description,
    ]
      .filter((value): value is string => typeof value === "string")
      .join("\n\n"),
  );
}

function getEventDate(event: OsmEvent): string | undefined {
  if (event.startdate_g) {
    return event.startdate_g;
  }

  if (event.startdate && /^\d{4}-\d{2}-\d{2}$/.test(event.startdate)) {
    return event.startdate;
  }

  if (event.date) {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(event.date);

    if (match) {
      const [, day, month, year] = match;
      return `${year}-${month}-${day}`;
    }
  }

  return undefined;
}
