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

export interface BadgeRecordsResponse {
  status: boolean;
  error: string | null;
  data: {
    requirements?: BadgeRequirement[];

    [key: string]: unknown;
  };

  [key: string]: unknown;
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
