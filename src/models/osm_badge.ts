export interface AvailableBadgesResponse {
  badge_id: number;
  badge_version: number;
  name: string;
  picture: string;
  config: unknown;
  latest: number;
  group_name: string;
  at_home: boolean;
}

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
