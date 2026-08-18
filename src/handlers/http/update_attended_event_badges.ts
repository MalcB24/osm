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
  ActualAttendanceMember,
  EventBadgeLink,
  OsmEvent,
  OsmEventDetails,
} from "../../models/index.js";

interface UpdateAttendedEventBadgesRequest {
  date: string;
  text: string;
  eventId?: string | number;
  section?: string;
}

interface BadgeUpdateTarget {
  event: {
    eventId: string;
    name: string;
  };
  badgeId: string | number;
  badgeVersion: string | number;
  field: string | number;
  badgeName: string;
  requirementName?: string;
}

interface MemberUpdateResult {
  scoutId: number;
  fullName: string;
  badges: Array<{
    eventId: string;
    eventName: string;
    badgeId: string | number;
    badgeVersion: string | number;
    field: string | number;
    badgeName: string;
    requirementName?: string;
    success: boolean;
    error?: string;
  }>;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function parseDate(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error('Missing or invalid "date".');
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(
      `Invalid date "${value}". Expected YYYY-MM-DD.`,
    );
  }

  return value;
}

async function getRequestBody(
  request: HttpRequest,
): Promise<UpdateAttendedEventBadgesRequest> {
  const body = (await request.json()) as unknown;

  if (!isRecord(body)) {
    throw new Error("Request body must be a JSON object.");
  }

  if (typeof body.text !== "string" || body.text.length === 0) {
    throw new Error('Missing or invalid "text".');
  }

  const parsedBody: UpdateAttendedEventBadgesRequest = {
    date: parseDate(body.date),
    text: body.text,
  };

  if (
    typeof body.eventId === "string" ||
    typeof body.eventId === "number"
  ) {
    parsedBody.eventId = body.eventId;
  }

  if (typeof body.section === "string") {
    parsedBody.section = body.section;
  }

  return parsedBody;
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

async function getEventsForRequest(
  client: OSMClient,
  sectionId: string,
  termId: string,
  body: UpdateAttendedEventBadgesRequest,
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

function getPresentScouts(
  attendance: ActualAttendanceMember[],
  date: string,
): ActualAttendanceMember[] {
  return attendance.filter((scout) => scout[date] === "Yes");
}

function getBadgeTargets(
  events: OsmEventDetails[],
): BadgeUpdateTarget[] {
  const targets = new Map<string, BadgeUpdateTarget>();

  for (const event of events) {
    for (const link of event.badgelinks ?? []) {
      const target = getBadgeTarget(event, link);
      const key = [
        target.event.eventId,
        target.badgeId,
        target.badgeVersion,
        target.field,
      ].join(":");

      targets.set(key, target);
    }
  }

  return [...targets.values()];
}

function getBadgeTarget(
  event: OsmEventDetails,
  link: EventBadgeLink,
): BadgeUpdateTarget {
  return {
    event: {
      eventId: String(event.eventid),
      name: event.name,
    },
    badgeId: link.badge_id,
    badgeVersion: link.badge_version,
    field: link.column_id,
    badgeName: link.badgeLongName,
    requirementName: link.data ?? link.columnnameLongName,
  };
}

function getScoutFullName(scout: ActualAttendanceMember): string {
  return `${scout.firstname} ${scout.lastname}`;
}

function createMemberResults(
  scouts: ActualAttendanceMember[],
): Map<number, MemberUpdateResult> {
  return new Map(
    scouts.map((scout) => [
      scout.scoutid,
      {
        scoutId: scout.scoutid,
        fullName: getScoutFullName(scout),
        badges: [],
      },
    ]),
  );
}

function addBadgeResult(
  memberResults: Map<number, MemberUpdateResult>,
  scouts: ActualAttendanceMember[],
  target: BadgeUpdateTarget,
  success: boolean,
  error?: string,
): void {
  for (const scout of scouts) {
    memberResults.get(scout.scoutid)?.badges.push({
      eventId: target.event.eventId,
      eventName: target.event.name,
      badgeId: target.badgeId,
      badgeVersion: target.badgeVersion,
      field: target.field,
      badgeName: target.badgeName,
      requirementName: target.requirementName,
      success,
      error,
    });
  }
}

export async function updateAttendedEventBadges(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const sectionId = getRequiredRouteParam(request, "sectionId");
  const termId = getRequiredRouteParam(request, "termId");
  let body: UpdateAttendedEventBadgesRequest;

  try {
    body = await getRequestBody(request);
  } catch (error) {
    return {
      status: 400,
      body:
        error instanceof Error
          ? error.message
          : "Invalid badge automation request.",
    };
  }

  const value = `AUTO ${body.date} - ${body.text}`;

  context.log(
    `Updating attended event badges for section "${sectionId}" term "${termId}" on "${body.date}".`,
  );

  const client = await OSMClient.create();

  try {
    const [events, attendance] = await Promise.all([
      getEventsForRequest(client, sectionId, termId, body),
      client.getActualAttendance(sectionId, termId, {
        section: body.section,
      }),
    ]);

    const presentScouts = getPresentScouts(attendance, body.date);
    const targets = getBadgeTargets(events);
    const memberResults = createMemberResults(presentScouts);

    if (presentScouts.length === 0 || targets.length === 0) {
      return {
        status: 200,
        jsonBody: {
          success: true,
          date: body.date,
          value,
          events: events.map((event) => ({
            eventId: event.eventid,
            name: event.name,
            badgeLinkCount: event.badgelinks?.length ?? 0,
          })),
          presentScoutCount: presentScouts.length,
          badgeUpdateCount: 0,
          members: [...memberResults.values()],
        },
      };
    }

    for (const target of targets) {
      try {
        await client.updateMultipleBadgeRecords({
          scoutIds: presentScouts.map((scout) => scout.scoutid),
          badgeId: target.badgeId,
          badgeVersion: target.badgeVersion,
          sectionId,
          field: target.field,
          value,
          overwrite: true,
          payload: 1,
        });

        addBadgeResult(memberResults, presentScouts, target, true);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown badge update error.";

        addBadgeResult(
          memberResults,
          presentScouts,
          target,
          false,
          message,
        );
      }
    }

    return {
      status: 200,
      jsonBody: {
        success: [...memberResults.values()].every((member) =>
          member.badges.every((badge) => badge.success),
        ),
        date: body.date,
        value,
        events: events.map((event) => ({
          eventId: event.eventid,
          name: event.name,
          badgeLinkCount: event.badgelinks?.length ?? 0,
        })),
        presentScoutCount: presentScouts.length,
        badgeUpdateCount: targets.length,
        members: [...memberResults.values()],
      },
    };
  } catch (error) {
    if (error instanceof OsmRequestError) {
      return {
        status: error.status,
        jsonBody: {
          success: false,
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

