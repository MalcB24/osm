import type {
  AvailableBadgesResponse,
  BadgesByMember,
  BadgesByMemberResponse,
  BadgeRecordsResponse,
  BadgeRecordsData,
  BadgeRecordUpdateResponse,
  BadgeRequirement,
  CreateEventBadgeLinkRequest,
  CreateEventBadgeLinkResponse,
  MultipleBadgeRecordUpdate,
  ActualAttendanceMember,
  ActualAttendanceResponse,
  EventsResponse,
  Id,
  MarkedAttendance,
  MarkedAttendanceResponse,
  MembersResponse,
  OsmEvent,
  OsmEventDetails,
  OsmMember,
  ResourceResponse,
  SectionTerm,
  SectionTermsResponse,
  SingleBadgeRecordUpdate,
} from "../models/index.js";

const resourceUrl = "https://osm.scouts.mt/oauth/resource";

export class OsmRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
  }
}

function getOsmLogicalStatusCode(
  response: { status?: boolean; error?: string | null },
): number {
  return response.error?.toLowerCase() === "no access"
    ? 403
    : 400;
}

export class OSMClient {
  private accessToken = "";

  private constructor() {}

  static async createWithAccessToken(
    accessToken: string,
  ): Promise<OSMClient> {
    const client = new OSMClient();

    client.accessToken = accessToken;

    if (!(await client.checkResourceAccess())) {
      await client.close();
      throw new Error("Unable to access OSM resource.");
    }

    return client;
  }

  async close(): Promise<void> {
    const r = await this.get(resourceUrl);

    if (r.status === 200) {
      console.log("Closing OSMClient");

      console.log(
        `X-RateLimit-Remaining: ${
          r.headers.get("X-RateLimit-Remaining") ?? "unknown"
        }`,
      );

      console.log(
        `X-RateLimit-Reset: ${
          r.headers.get("X-RateLimit-Reset") ?? "unknown"
        }`,
      );

      return;
    }

    if (r.status === 429) {
      const remainingTimeS = Number(
        r.headers.get("Retry-After") ?? 0,
      );

      console.log(
        `We're over the rate limit. Wait for ${
          remainingTimeS / 60
        } minutes before retrying.`,
      );

      console.log("Closing OSMClient");
      return;
    }

    console.log(
      `Got HTTP code ${r.status} at session closure. Closing it either way.`,
    );

    console.log(
      Object.fromEntries(r.headers.entries()),
    );

    console.log(await r.text());
  }

  private async request(
    url: string | URL,
    init: RequestInit = {},
  ): Promise<Response> {
    const headers = new Headers(init.headers);

    headers.set(
      "Authorization",
      `Bearer ${this.accessToken}`,
    );

    return fetch(url, {
      ...init,
      headers,
    });
  }

  private async get(
    url: string,
    params?: Record<string, string | number>,
  ): Promise<Response> {
    const requestUrl = new URL(url);

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        requestUrl.searchParams.set(key, String(value));
      }
    }

    return this.request(requestUrl);
  }

  private async postForm(
    url: string,
    queryParams: Record<string, string | number>,
    bodyParams: Record<string, string | number | boolean>,
  ): Promise<Response> {
    const requestUrl = new URL(url);

    for (const [key, value] of Object.entries(queryParams)) {
      requestUrl.searchParams.set(key, String(value));
    }

    const body = new URLSearchParams();

    for (const [key, value] of Object.entries(bodyParams)) {
      body.set(key, String(value));
    }

    return this.request(requestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
  }

  async checkResourceAccess(): Promise<boolean> {
    const r = await this.get(resourceUrl);

    if (r.status === 429) {
      const remainingTimeS = Number(
        r.headers.get("Retry-After") ?? 0,
      );

      console.log(
        `We're over the rate limit. Wait for ${
          remainingTimeS / 60
        } minutes before retrying.`,
      );

      return false;
    }

    if (r.status !== 200) {
      console.log(
        `We got HTTP code ${r.status} and will not proceed.`,
      );

      console.log(Object.fromEntries(r.headers.entries()));
      console.log(await r.text());

      return false;
    }

    if (r.headers.has("X-Blocked")) {
      console.log("We have been blocked.");
      console.log(Object.fromEntries(r.headers.entries()));

      return false;
    }

    let resources: ResourceResponse;

    try {
      resources = (await r.json()) as ResourceResponse;
    } catch {
      console.log('Call to "resources = r.json()" failed');
      return false;
    }

    if (!resources.status) {
      console.log(resources.error);
      return false;
    }

    console.log(
      `X-RateLimit-Remaining: ${
        r.headers.get("X-RateLimit-Remaining") ?? "unknown"
      }`,
    );

    console.log(
      `X-RateLimit-Reset: ${
        r.headers.get("X-RateLimit-Reset") ?? "unknown"
      }`,
    );

    return true;
  }

  async getMembers(
    sectionId: Id,
    termId: Id,
    options: {
      section?: string;
      sort?: string;
    } = {},
  ): Promise<OsmMember[] | null> {
    const r = await this.get(
      "https://osm.scouts.mt/ext/members/contact/",
      {
        action: "getListOfMembers",
        sort: options.sort ?? "dob",
        sectionid: sectionId,
        termid: termId,
        section: options.section ?? "mtventures",
      },
    );

    const data = (await r.json()) as MembersResponse;

    if (!data.items) {
      console.log(JSON.stringify(data));
      return null;
    }

    return data.items;
  }

  async getScouts(
    sectionId: Id,
    termId: Id,
    options: {
      section?: string;
      sort?: string;
    } = {},
  ): Promise<OsmMember[]> {
    return (
      (await this.getMembers(
        sectionId,
        termId,
        options,
      )) ?? []
    );
  }

  async getTerms(sectionId: Id): Promise<SectionTerm[]> {
    const r = await this.get(
      `https://osm.scouts.mt/v3/settings/terms/recurring/${sectionId}`,
    );

    if (!r.ok) {
      const body = await r.text();

      throw new OsmRequestError(
        `Terms request failed: ${r.status} ${body}`,
        r.status,
        body,
      );
    }

    const data = (await r.json()) as SectionTermsResponse;

    if (!data.status) {
      throw new Error(data.error ?? "Unable to get terms.");
    }

    return data.data.terms[String(sectionId)] ?? [];
  }

  async *sections(): AsyncGenerator<[string, Id, Id]> {
    const r = await this.get(resourceUrl);
    const data = (await r.json()) as ResourceResponse;

    for (const section of data.data.sections) {
      if (section.group_name === "Filfla Scout Group") {
        continue;
      }

      const sectionName = section.section_name;
      const sectionId = section.section_id;
      const termId =
        section.terms[section.terms.length - 1].term_id;

      yield [sectionName, sectionId, termId];
    }
  }

  async getEvents(
    sectionId: Id,
    termId: Id,
  ): Promise<OsmEvent[]> {
    const r = await this.get(
      "https://osm.scouts.mt/ext/events/summary/",
      {
        action: "get",
        sectionid: sectionId,
        termid: termId,
      },
    );

    try {
      const data = (await r.json()) as EventsResponse;
      return data.items ?? [];
    } catch {
      console.log(await r.text());
      return [];
    }
  }

  async getEvent(
    sectionId: Id,
    eventId: Id,
  ): Promise<OsmEventDetails> {
    const r = await this.get(
      "https://osm.scouts.mt/ext/events/event/",
      {
        action: "getStructureForEvent",
        sectionid: sectionId,
        eventid: eventId,
      },
    );

    if (!r.ok) {
      const body = await r.text();

      throw new OsmRequestError(
        `Event request failed: ${r.status} ${body}`,
        r.status,
        body,
      );
    }

    return (await r.json()) as OsmEventDetails;
  }

  async getMarkedAttendance(
    sectionId: Id,
    termId: Id,
    eventId: Id,
    options: {
      mode?: string;
    } = {},
  ): Promise<MarkedAttendance[]> {
    const r = await this.get(
      "https://osm.scouts.mt/ext/events/event/",
      {
        action: "getAttendance",
        eventid: eventId,
        sectionid: sectionId,
        termid: termId,
        mode: options.mode ?? "all",
      },
    );

    const data =
      (await r.json()) as MarkedAttendanceResponse;

    return data.items ?? [];
  }

  async getActualAttendance(
    sectionId: Id,
    termId: Id,
    options: {
      section?: string;
      noTotal?: boolean;
    } = {},
  ): Promise<ActualAttendanceMember[]> {
    const noTotal = options.noTotal ?? true;

    const r = await this.get(
      "https://osm.scouts.mt/ext/members/attendance/",
      {
        action: "get",
        sectionid: sectionId,
        termid: termId,
        section: options.section ?? "mtventures",
        nototal: noTotal ? "true" : "false",
      },
    );

    if (!r.ok) {
      const body = await r.text();

      throw new OsmRequestError(
        `Actual attendance request failed: ${r.status} ${body}`,
        r.status,
        body,
      );
    }

    const data = (await r.json()) as ActualAttendanceResponse;
    return data.items ?? [];
  }

  async getAvailableBadges(
    sectionId: Id,
    options: {
      section?: string;
      typeId?: Id;
      payload?: Id;
      context?: string;
      memberId?: Id;
    } = {},
  ): Promise<AvailableBadgesResponse> {
    const r = await this.get(
      "https://osm.scouts.mt/ext/badges/records/",
      {
        action: "getAvailableBadges",
        section: options.section ?? "mtventures",
        sectionid: sectionId,
        type_id: options.typeId ?? 1,
        payload: options.payload ?? 1,
        context: options.context ?? "none",
        member_id: options.memberId ?? 0,
      },
    );

    return (await r.json()) as AvailableBadgesResponse;
  }

  async getBadgeRequirements(
    sectionId: Id,
    termId: Id,
    badgeId: Id,
    badgeVersion: Id,
    options: {
      section?: string;
      payload?: Id;
      typeId?: Id;
    } = {},
  ): Promise<BadgeRequirement[]> {
    return (
      await this.getBadgeRecords(
        sectionId,
        termId,
        badgeId,
        badgeVersion,
        options,
      )
    ).requirements ?? [];
  }

  async getBadgeRecords(
    sectionId: Id,
    termId: Id,
    badgeId: Id,
    badgeVersion: Id,
    options: {
      section?: string;
      payload?: Id;
      typeId?: Id;
    } = {},
  ): Promise<BadgeRecordsData> {
    const r = await this.get(
      "https://osm.scouts.mt/ext/badges/records/",
      {
        action: "getBadgeRecords",
        term_id: termId,
        section: options.section ?? "mtventures",
        badge_id: badgeId,
        section_id: sectionId,
        badge_version: badgeVersion,
        payload: options.payload ?? 1,
        type_id: options.typeId ?? 1,
      },
    );

    if (!r.ok) {
      const body = await r.text();

      throw new OsmRequestError(
        `Badge records request failed: ${r.status} ${body}`,
        r.status,
        body,
      );
    }

    const data = (await r.json()) as BadgeRecordsResponse;

    if (!data.status) {
      const body = JSON.stringify(data);

      throw new OsmRequestError(
        `Badge records request failed: ${body}`,
        getOsmLogicalStatusCode(data),
        body,
      );
    }

    return data.data;
  }

  async getBadgesByMember(
    sectionId: Id,
    termId: Id,
    options: {
      section?: string;
    } = {},
  ): Promise<BadgesByMember[]> {
    const r = await this.get(
      "https://osm.scouts.mt/ext/badges/badgesbyperson/",
      {
        action: "loadBadgesByMember",
        section: options.section ?? "mtventures",
        sectionid: sectionId,
        term_id: termId,
      },
    );

    if (!r.ok) {
      const body = await r.text();

      throw new OsmRequestError(
        `Badges by member request failed: ${r.status} ${body}`,
        r.status,
        body,
      );
    }

    const data = (await r.json()) as BadgesByMemberResponse;

    if (!data.status) {
      throw new Error(data.error ?? "Unable to get badges by member.");
    }

    return data.data ?? [];
  }

  async updateSingleBadgeRecord(
    update: SingleBadgeRecordUpdate,
  ): Promise<BadgeRecordUpdateResponse> {
    const r = await this.postForm(
      "https://osm.scouts.mt/ext/badges/records/",
      { action: "updateSingleRecord" },
      {
        scoutid: update.scoutId,
        badge_id: update.badgeId,
        badge_version: update.badgeVersion,
        batch: JSON.stringify(update.values),
        section_id: update.sectionId,
        payload: update.payload ?? true,
      },
    );

    if (!r.ok) {
      const body = await r.text();

      throw new OsmRequestError(
        `Badge record update failed: ${r.status} ${body}`,
        r.status,
        body,
      );
    }

    const data = (await r.json()) as BadgeRecordUpdateResponse;

    if (data.status === false || data.error) {
      const body = JSON.stringify(data);

      throw new OsmRequestError(
        `Badge record update failed: ${body}`,
        getOsmLogicalStatusCode(data),
        body,
      );
    }

    return data;
  }

  async updateMultipleBadgeRecords(
    update: MultipleBadgeRecordUpdate,
  ): Promise<BadgeRecordUpdateResponse> {
    const r = await this.postForm(
      "https://osm.scouts.mt/ext/badges/records/",
      { action: "updateMultipleRecords" },
      {
        scouts: JSON.stringify(update.scoutIds),
        value: update.value,
        field: update.field,
        section_id: update.sectionId,
        overwrite: update.overwrite ?? true,
        badge_id: update.badgeId,
        badge_version: update.badgeVersion,
        payload: update.payload ?? 1,
      },
    );

    if (!r.ok) {
      const body = await r.text();

      throw new OsmRequestError(
        `Badge records update failed: ${r.status} ${body}`,
        r.status,
        body,
      );
    }

    const data = (await r.json()) as BadgeRecordUpdateResponse;

    if (data.status === false || data.error) {
      const body = JSON.stringify(data);

      throw new OsmRequestError(
        `Badge records update failed: ${body}`,
        getOsmLogicalStatusCode(data),
        body,
      );
    }

    return data;
  }

  async linkBadgeToEvent(
    link: CreateEventBadgeLinkRequest,
  ): Promise<CreateEventBadgeLinkResponse> {
    const r = await this.postForm(
      "https://osm.scouts.mt/ext/badges/records/",
      {
        action: "linkBadgeToItem",
        sectionid: link.sectionId,
      },
      {
        section: link.section ?? "mtventures",
        sectionid: link.sectionId,
        type: "event",
        id: link.eventId,
        badge_id: link.badgeId,
        badge_version: link.badgeVersion,
        column_id: link.columnId,
        column_data: link.columnData,
        new_column_name: link.newColumnName ?? "",
      },
    );

    if (!r.ok) {
      const body = await r.text();

      throw new OsmRequestError(
        `Event badge link failed: ${r.status} ${body}`,
        r.status,
        body,
      );
    }

    const data = (await r.json()) as CreateEventBadgeLinkResponse;

    if (data.status === false || data.error) {
      const body = JSON.stringify(data);

      throw new OsmRequestError(
        `Event badge link failed: ${body}`,
        getOsmLogicalStatusCode(data),
        body,
      );
    }

    return data;
  }
}
