import type { Id } from "./id.js";

export interface OsmEvent {
  eventid: Id;
  name: string;
  date?: string;
  startdate_g?: string;
  startdate?: string;
  enddate?: string;
  starttime?: string;
  endtime?: string;
  cost?: string;
  location?: string;
  yes?: number;
  no?: number;
  invited?: number;
  shown?: number;

  [key: string]: unknown;
}

export interface EventsResponse {
  identifier?: string;
  items?: OsmEvent[];
}

export interface EventBadgeLink {
  picture?: string;
  link_relation_id: Id;
  same_as?: unknown[];
  badge_id: Id;
  badge_version: Id;
  column_id: Id;
  badge?: string;
  badgeLongName: string;
  badgetype?: string;
  badgetypeLongName?: string;
  columnname?: string;
  columnnameLongName?: string;
  data?: string;
  section?: string;
  sectionLongName?: string;

  [key: string]: unknown;
}

export interface OsmEventDetails {
  eventid: Id;
  name: string;
  type: string | null;
  startdate: string;
  enddate: string;
  starttime: string | null;
  endtime: string | null;
  cost?: string;
  location?: string;
  notes?: string;
  notepad?: string;
  publicnotes?: string;
  sectionid: Id;
  badgelinks?: EventBadgeLink[];

  [key: string]: unknown;
}

export interface MarkedAttendance {
  scoutid: Id;
  attending: string;
  payment?: string;
  firstname: string;
  lastname: string;
  dob?: string;
  patrolid?: number;
  photo_guid?: string;
  emailable?: boolean;
  _filterString?: string;

  [key: string]: unknown;
}

export interface MarkedAttendanceResponse {
  identifier?: string;
  eventid?: Id;
  items?: MarkedAttendance[];
}
