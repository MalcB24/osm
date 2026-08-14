import type { Id } from "./id.js";

export interface OsmTerm {
  term_id: Id;
}

export interface SectionTerm {
  termid: Id;
  sectionid: Id;
  name: string;
  startdate: string;
  enddate: string;
  master_term: Id | null;
  past: boolean;
}

export interface OsmSection {
  group_name: string;
  section_name: string;
  section_id: Id;
  terms: OsmTerm[];
}

export interface ResourceResponse {
  status: boolean;
  error?: string;
  data: {
    sections: OsmSection[];
  };
}

export interface SectionTermsResponse {
  status: boolean;
  error: string | null;
  data: {
    recurring_config: unknown;
    terms: Record<string, SectionTerm[]>;
  };
  meta?: unknown[];
}
