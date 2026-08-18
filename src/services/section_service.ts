import type { OSMClient } from "../clients/osm_client.js";

export interface SectionSummary {
  sectionId: string;
  termId: string;
}

export async function getSections(
  client: OSMClient,
): Promise<Record<string, SectionSummary>> {
  const sections: Record<string, SectionSummary> = {};

  for await (const [
    sectionName,
    sectionId,
    termId,
  ] of client.sections()) {
    sections[sectionName] = {
      sectionId: sectionId.toString(),
      termId: termId.toString(),
    };
  }

  return sections;
}
