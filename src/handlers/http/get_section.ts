import {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

import { createOsmClientForRequest } from "../../utils/http.js";

import { OSMClient } from "../../clients/osm_client.js";
import { getSections } from "../../services/section_service.js";

export async function getSection(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  context.log(
    `Getting OSM sections for request "${request.url}".`,
  );

  const client = await createOsmClientForRequest(request);

  try {
    return {
      status: 200,
      jsonBody: await getSections(client),
    };
  } finally {
    await client.close();
  }
}
