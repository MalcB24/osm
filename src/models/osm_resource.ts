import type { Id } from "./id.js";

export interface OsmTerm {
  term_id: Id;
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
