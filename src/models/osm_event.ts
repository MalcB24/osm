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
