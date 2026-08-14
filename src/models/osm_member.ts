export interface OsmMember {
  firstname?: string;
  lastname?: string;
  photo_guid?: string;
  patrolid?: number;
  patrol?: string;
  sectionid?: number;
  startdate?: string;
  enddate?: string | null;
  age?: string;
  patrol_role_level_label?: string;
  active?: boolean;
  scoutid?: number;
  full_name: string;
  has_invitations?: boolean;

  [key: string]: unknown;
}

export interface MembersResponse {
  identifier?: string;
  photos?: boolean;
  items?: OsmMember[];
}

export interface ActualAttendanceResponse {
  identifier?: string;
  label?: string;
  items?: ActualAttendanceMember[];
  visitors?: Record<string, unknown>;
  parent_rota?: Record<string, unknown>;
  meetings?: unknown[];
}

export interface ActualAttendanceMember {
  firstname: string;
  lastname: string;
  photo_guid?: string;
  patrolid?: number;
  patrolleader?: string;
  patrol?: string;
  dob?: string;
  sectionid?: number;
  startdate?: string;
  enddate?: string | null;
  age?: string;
  patrol_role_level_label?: string;
  active?: boolean;
  total?: number;
  scoutid: number;
  _filterString?: string;

  [dateOrKey: string]: unknown;
}

export interface ActualAttendanceEntry {
  scoutid: number;
  firstname: string;
  lastname: string;
  full_name: string;
  patrol?: string;
  attendance: "Yes" | "No" | "Unknown";
  attended: boolean;
  responded: boolean;
}

export interface ActualAttendanceDate {
  date: string;
  entries: ActualAttendanceEntry[];
  totals: {
    yes: number;
    no: number;
    unknown: number;
  };
}

export interface ActualAttendanceResult {
  availableDates: string[];
  dates: ActualAttendanceDate[];
}
