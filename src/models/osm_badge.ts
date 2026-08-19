export interface AvailableBadge {
  badge_id: number;
  badge_version: number;
  name: string;
  picture: string;
  config: unknown;
  latest: number;
  group_name: string;
  at_home: boolean;
}

export type AvailableBadgesResponse =
  | AvailableBadge
  | AvailableBadge[]
  | {
      items?: AvailableBadge[];
      data?: AvailableBadge[] | Record<string, AvailableBadge[]>;
      badges?: AvailableBadge[];

      [key: string]: unknown;
    };

export interface BadgeRequirement {
  name: string;
  width: string;
  tooltip: string;
  module: string;
  section_id: number;
  sameas: string;
  points: number;
  deletable: boolean;
  editable: string;
  requirement_id: number;
}

export interface BadgeDetails {
  name: string;
  picture?: string;
  description?: string;
  config?: unknown;
  parents_description?: string;
  sharing?: string;
  badge_group?: string;
  user_id?: number;
  created_at?: string;

  [key: string]: unknown;
}

export interface BadgeRecordMember {
  firstname: string;
  lastname: string;
  awarded?: number;
  completed?: number;
  awardeddate?: string;
  photo_guid?: string;
  column_data?: Record<string, string> | unknown[];
  completed_requirements?: number[];
  read_only?: boolean;
  member_id: number;
  eligible?: boolean;

  [key: string]: unknown;
}

export interface BadgeRecordsData {
  details?: BadgeDetails;
  programme?: unknown[];
  requirements?: BadgeRequirement[];
  modules?: Record<string, unknown>;
  members?: BadgeRecordMember[];

  [key: string]: unknown;
}

export interface BadgeRecordsResponse {
  status: boolean;
  error: string | null;
  data: BadgeRecordsData;

  [key: string]: unknown;
}

export type BadgeRequirementMemberState =
  | "complete"
  | "Has Note"
  | "Not Complete";

export interface BadgeProgressMember {
  memberId: number;
  firstname: string;
  lastname: string;
  // fullName: string;
  // photoGuid?: string;
  awarded?: number;
  completed?: number;
  awardedDate?: string;
  eligible?: boolean;
  // readOnly?: boolean;
  note: string;
  state: BadgeRequirementMemberState;
}

export interface BadgeProgressRequirement
  extends BadgeRequirement {
  members: BadgeProgressMember[];
}

export interface BadgeProgress {
  details: BadgeDetails;
  requirements: BadgeProgressRequirement[];
}

export interface BadgeByMember {
  completed: string;
  awarded: string;
  awarded_date: number;
  badge: string;
  badge_shortname: string;
  badge_group: string;
  status: number;
  picture: string;
  badge_identifier: string;
  badge_id: string;
  order: number;
  group_name: string;
  level: boolean;

  [key: string]: unknown;
}

export interface BadgesByMember {
  firstname: string;
  lastname: string;
  scout_id: number;
  photo_guid?: string;
  // patrolid?: number;
  // patrolleader?: string;
  // patrol?: string;
  dob?: string;
  sectionid?: number;
  enddate?: string | null;
  age?: string;
  // patrol_role_level_label?: string;
  active?: boolean;
  scoutid: number;
  badges: BadgeByMember[];

  [key: string]: unknown;
}

export interface BadgesByMemberResponse {
  status: boolean;
  error: string | null;
  data: BadgesByMember[];
  meta?: unknown[];
}

export interface BadgeRecordUpdateResponse {
  status?: boolean;
  error?: string | null;
  data?: unknown[];
  meta?: unknown[];
}

export interface SingleBadgeRecordUpdate {
  scoutId: string | number;
  badgeId: string | number;
  badgeVersion: string | number;
  sectionId: string | number;
  values: Record<string, string>;
  payload?: boolean | number | string;
}

export interface MultipleBadgeRecordUpdate {
  scoutIds: Array<string | number>;
  badgeId: string | number;
  badgeVersion: string | number;
  sectionId: string | number;
  field: string | number;
  value: string;
  overwrite?: boolean;
  payload?: boolean | number | string;
}

export interface CreateEventBadgeLinkRequest {
  sectionId: string | number;
  eventId: string | number;
  badgeId: string | number;
  badgeVersion: string | number;
  columnId: string | number;
  columnData: string;
  section?: string;
  newColumnName?: string;
}

export interface CreateEventBadgeLinkResponse {
  status?: boolean;
  error?: string | null;
  data?: {
    relation_id?: string | number;
    column_id?: string | number;

    [key: string]: unknown;
  };
  meta?: unknown[];
}
