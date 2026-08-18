import {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

import { OSMClient } from "../../clients/osm_client.js";

export async function getSection(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  context.log(
    `Getting OSM sections for request "${request.url}".`,
  );

  const client = await OSMClient.create();

  try {
    const sections: Record<
      string,
      { sectionId: string; termId: string }
    > = {};

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

    return {
      status: 200,
      jsonBody: sections,
    };
  } finally {
    await client.close();
  }
}

