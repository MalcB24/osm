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
