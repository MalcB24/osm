import type {
  AvailableBadgesResponse,
  BadgeRecordsResponse,
  BadgeRecordUpdateResponse,
  BadgeRequirement,
  EventBadgeLinkCreate,
  EventBadgeLinkCreateResponse,
  MultipleBadgeRecordUpdate,
  ActualAttendanceMember,
  ActualAttendanceResponse,
  EventsResponse,
  Id,
  MarkedAttendance,
  MarkedAttendanceResponse,
  MembersResponse,
  OAuthToken,
  OsmEvent,
  OsmEventDetails,
  OsmMember,
  ResourceResponse,
  SectionTerm,
  SectionTermsResponse,
  SingleBadgeRecordUpdate,
} from "../models/index.js";
import { KeyVaultService } from "../services/key_vault_service.js";

const tokenUrl = "https://osm.scouts.mt/oauth/token";
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
  private clientId = "";
  private clientSecret = "";
  private token!: OAuthToken;

  private readonly keyVault: KeyVaultService;

  private constructor() {
    this.keyVault = new KeyVaultService();
  }

  static async create(): Promise<OSMClient> {
    const client = new OSMClient();

    await client.getOsmClientAzure();

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

  /**
   * Load OSM credentials and the OAuth token from Azure Key Vault.
   *
   * Required secrets:
   *   osm-client-id
   *   osm-client-secret
   *   osm-token
   *
   * Function Apps cannot complete an interactive OAuth flow, so the token
   * must be provisioned before this client is used.
   */
  private async getOsmClientAzure(): Promise<void> {
    const { clientId, clientSecret } =
      await this.keyVault.getOsmCredentials();

    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.token = await this.keyVault.getOsmToken();

    await this.ensureValidToken();
  }

  /**
   * Save the current OAuth token directly to Azure Key Vault.
   *
   * This is the only token persistence mechanism used by this class.
   * No token.json or other local file is created.
   */
  private async saveToken(): Promise<void> {
    await this.keyVault.saveOsmToken(this.token);
  }

  private normalizeToken(token: OAuthToken): OAuthToken {
    if (
      token.expires_in !== undefined &&
      token.expires_at === undefined
    ) {
      token.expires_at =
        Math.floor(Date.now() / 1000) +
        Number(token.expires_in);
    }

    return token;
  }

  private tokenIsExpired(): boolean {
    if (!this.token.expires_at) {
      return false;
    }

    // Refresh slightly early to avoid expiry during an API request.
    return Date.now() / 1000 >= this.token.expires_at - 30;
  }

  private async ensureValidToken(): Promise<void> {
    if (!this.tokenIsExpired()) {
      return;
    }

    if (!this.token.refresh_token) {
      throw new Error(
        "OAuth token has expired and no refresh token is available.",
      );
    }

    await this.refreshAccessToken();
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.token.refresh_token) {
      throw new Error("No refresh token available.");
    }

    const previousRefreshToken = this.token.refresh_token;

    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: previousRefreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!response.ok) {
      throw new Error(
        `Token refresh failed: ${response.status} ${await response.text()}`,
      );
    }

    const refreshedToken = this.normalizeToken(
      (await response.json()) as OAuthToken,
    );

    // OAuth servers do not always return a new refresh token.
    if (!refreshedToken.refresh_token) {
      refreshedToken.refresh_token = previousRefreshToken;
    }

    this.token = refreshedToken;

    await this.saveToken();
  }

  private async request(
    url: string | URL,
    init: RequestInit = {},
    allowRetry = true,
  ): Promise<Response> {
    await this.ensureValidToken();

    const headers = new Headers(init.headers);

    headers.set(
      "Authorization",
      `Bearer ${this.token.access_token}`,
    );

    const response = await fetch(url, {
      ...init,
      headers,
    });

    if (response.status === 401 && allowRetry) {
      if (this.token.refresh_token) {
        await this.refreshAccessToken();
      } else {
        throw new Error(
          "OSM request was unauthorized and no refresh token is available.",
        );
      }

      return this.request(url, init, false);
    }

    return response;
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

    const data = (await r.json()) as BadgeRecordsResponse;

    if (!data.status) {
      throw new Error(data.error ?? "Unable to get badge records.");
    }

    return data.data.requirements ?? [];
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
    link: EventBadgeLinkCreate,
  ): Promise<EventBadgeLinkCreateResponse> {
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
        // picture: link.picture,
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

    const data = (await r.json()) as EventBadgeLinkCreateResponse;

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
