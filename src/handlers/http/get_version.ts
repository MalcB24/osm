import {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

import packageJson from "../../../package.json" with { type: "json" };

export async function getVersion(
  _request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  context.log("Returning public version metadata.");

  return {
    status: 200,
    jsonBody: {
      name: "osm-functions",
      version: packageJson.version,
    },
  };
}
