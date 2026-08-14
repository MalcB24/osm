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
