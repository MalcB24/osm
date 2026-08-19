# OSM Functions API and MCP Tools

Azure Functions app for working with Online Scout Manager (OSM). It exposes the same core OSM logic through HTTP endpoints and MCP tools, with authorization based on the OSM user connected by the caller.

## What It Does

- Proxies OAuth authorization and token exchange to OSM for ChatGPT, Postman, and other OAuth clients.
- Advertises OAuth metadata with PKCE `S256` support for ChatGPT connector setup.
- Reads sections, terms, scouts, events, badges, badge requirements, and attendance.
- Links badge requirements to events.
- Updates badge records from JSON API requests.
- Suggests badge requirement matches using Azure OpenAI.
- Exposes MCP tools for agents, including a `get_today` helper so agents do not guess the current date.

## Auth Model

The app does not store an OSM access token, refresh token, client ID, or client secret.

Each caller authenticates with OSM through the app OAuth endpoints. The resulting OSM bearer token is then sent back to this app on HTTP and MCP calls:

- HTTP requests use `Authorization: Bearer <osm-access-token>`.
- ChatGPT MCP requests pass the bearer token in the MCP transport headers.
- Missing HTTP bearer tokens return `401` JSON instead of an unhandled function error.

The app OAuth endpoints are a small compatibility layer in front of OSM OAuth. They exist so ChatGPT can discover `code_challenge_methods_supported: ["S256"]` and so the same app URL can be used as the connector authorization server.

## Requirements

- Node.js
- Azure Functions Core Tools v4
- OSM OAuth application credentials, configured in the OAuth client such as ChatGPT or Postman
- Azure OpenAI / Azure AI Foundry deployment for suggestion tools

## Setup

Install dependencies:

```bash
npm install
```

Create or update `local.settings.json` with these values:

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AZURE_OPENAI_ENDPOINT": "<azure-openai-or-foundry-endpoint>",
    "AZURE_OPENAI_DEPLOYMENT": "<deployment-name>",
    "AZURE_OPENAI_API_VERSION": "v1",
    "NODE_ENV": "development"
  }
}
```

Optional OAuth metadata overrides for deployed or proxied environments:

| Setting | Purpose |
| --- | --- |
| `CHATGPT_AUTH_BASE_URL` | Public base URL used in OAuth metadata, for example `https://osm-tools-aphgfshtbgecdcfc.westeurope-01.azurewebsites.net` |
| `CHATGPT_AUTH_RESOURCE_URL` | Resource value advertised in protected-resource metadata |
| `CHATGPT_AUTH_ISSUER` | Issuer value advertised in OAuth metadata |

Do not put OSM client credentials or requested OSM scopes in app settings. Configure those in the OAuth client.

## Running Locally

Build:

```bash
npm run build
```

Start with HTTPS:

```bash
npm start
```

The app uses:

```json
"main": "dist/functions/*.js"
```

If functions are not loading, run a clean build:

```bash
npm run clean && npm run build
```

## ChatGPT Connector Setup

For the deployed app:

```text
https://osm-tools-aphgfshtbgecdcfc.westeurope-01.azurewebsites.net
```

Use these values in the ChatGPT connector configuration:

| Field | Value |
| --- | --- |
| MCP server URL | `https://osm-tools-aphgfshtbgecdcfc.westeurope-01.azurewebsites.net/runtime/webhooks/mcp` |
| OAuth Client ID | Your OSM OAuth app client ID |
| OAuth Client Secret | Your OSM OAuth app client secret |
| Token endpoint auth method | `client_secret_post` |
| Auth URL | `https://osm-tools-aphgfshtbgecdcfc.westeurope-01.azurewebsites.net/oauth/authorize` |
| Token URL | `https://osm-tools-aphgfshtbgecdcfc.westeurope-01.azurewebsites.net/oauth/token` |
| Registration URL | Leave blank unless ChatGPT requires one |
| Authorization server base | `https://osm-tools-aphgfshtbgecdcfc.westeurope-01.azurewebsites.net` |
| Resource | `https://osm-tools-aphgfshtbgecdcfc.westeurope-01.azurewebsites.net` |
| OIDC configuration URL | `https://osm-tools-aphgfshtbgecdcfc.westeurope-01.azurewebsites.net/.well-known/openid-configuration` |
| OIDC userinfo endpoint | `https://osm.scouts.mt/oauth/resource` |

Default read scopes:

```text
section:member:read section:event:read section:badge:read section:attendance:read
```

Add write scopes only when the connector needs write tools:

```text
section:member:write section:event:write section:badge:write section:attendance:write
```

OSM requires the OAuth client credentials during the token request. In ChatGPT, this means the token endpoint auth method should send the client ID and client secret to `/oauth/token`; `client_secret_post` is the safest choice for this app.

## Postman OAuth Setup

Use Authorization Code with PKCE:

| Field | Value |
| --- | --- |
| Auth URL | `https://<your-app-host>/oauth/authorize` |
| Access Token URL | `https://<your-app-host>/oauth/token` |
| Client ID | Your OSM OAuth app client ID |
| Client Secret | Your OSM OAuth app client secret |
| Code challenge method | `S256` |
| Scope | Space-separated OSM scopes |

The redirect/callback URL used by Postman or ChatGPT must also be registered in the OSM OAuth app.

## OAuth Endpoints

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/.well-known/oauth-protected-resource` | Protected resource metadata |
| GET | `/.well-known/oauth-authorization-server` | OAuth authorization server metadata |
| GET | `/.well-known/openid-configuration` | OpenID-style metadata for OAuth clients |
| GET | `/oauth/authorize` | Redirects authorization requests to OSM |
| POST | `/oauth/token` | Exchanges or refreshes tokens with OSM |

The adapter intentionally does not forward a `resource` query parameter to OSM. OSM authorizes by scopes, and forwarding `resource` can cause provider-side target mismatch errors.

## HTTP Endpoints

Base URL locally:

```text
https://localhost:7071/api
```

All HTTP API routes require:

```text
Authorization: Bearer <osm-access-token>
```

Read endpoints:

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/sections` | Get available OSM sections |
| GET | `/sections/{sectionId}/terms` | Get terms for a section |
| GET | `/sections/{sectionId}/terms/{termId}/scouts` | Get scouts |
| GET | `/sections/{sectionId}/terms/{termId}/events` | Get events |
| GET | `/sections/{sectionId}/events/{eventId}` | Get event details |
| GET | `/sections/{sectionId}/terms/{termId}/events/{eventId}/marked-attendance` | Get event marked attendance |
| GET | `/sections/{sectionId}/terms/{termId}/actual-attendance` | Get actual attendance grouped by date |
| GET | `/sections/{sectionId}/available-badges` | Get available badges |
| GET | `/sections/{sectionId}/terms/{termId}/badges/{badgeId}/versions/{badgeVersion}/requirements` | Get badge requirements |

Write / suggestion endpoints:

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/sections/{sectionId}/terms/{termId}/badge-records` | Update one or more badge records |
| POST | `/sections/{sectionId}/terms/{termId}/attended-event-badges` | Update badge records for scouts present on a date/event |
| POST | `/sections/{sectionId}/terms/{termId}/event-badge-suggestions` | Suggest badge matches for an event/date |
| POST | `/sections/{sectionId}/terms/{termId}/god-badge-suggestions` | Suggest god badge matches for supplied text |
| POST | `/sections/{sectionId}/events/{eventId}/badges` | Link a badge requirement to an event |

## Useful Query Parameters

Events:

- `date=YYYY-MM-DD`

Actual attendance:

- `date=YYYY-MM-DD` or `onDate=YYYY-MM-DD`
- `scoutId=1234`
- `scoutIds=1234,5678`
- `scoutName=Sarah` or `name=Sarah`
- `patrol=Executive`
- `section=mtventures`

Marked attendance:

- `mode=all`

Terms support filters such as current, past, future, and date-based filtering in the handler.

## MCP Tools

Read-only tools:

| Tool | Purpose |
| --- | --- |
| `get_today` | Returns today's date in `YYYY-MM-DD`, defaulting to `Europe/Malta` |
| `osm_get_sections` | Get sections available to the authenticated OSM user |
| `osm_get_terms` | Get terms for a section |
| `osm_get_scouts` | Get scouts for a section and term |
| `osm_get_events` | Get events for a section and term |
| `osm_get_event` | Get full event details |
| `osm_get_marked_attendance` | Get attendance marked against an event |
| `osm_get_actual_attendance` | Get actual attendance grouped by date |
| `osm_get_available_badges` | Get available badges |
| `osm_get_badge_requirements` | Get badge requirements |

Suggestion tools:

| Tool | Purpose |
| --- | --- |
| `osm_suggest_event_badges` | Suggest badge requirements for an event or date |
| `osm_suggest_god_badges` | Suggest Olympian Missions god badge requirements for supplied text |

Write tools:

| Tool | Purpose |
| --- | --- |
| `osm_link_event_badge` | Link a badge requirement to an event |

Use `get_today` before asking an agent to filter by "today". MCP agents may not know the real current date, and this project expects OSM date filters in `YYYY-MM-DD`.

## Project Structure

```text
src/
  clients/
    osm_client.ts
  functions/
    http_routes.ts
    mcp_tools.ts
  handlers/
    http/
    mcp/
  models/
  requests/
  services/
  utils/
```

Important pattern:

- `src/functions/*` registers Azure Functions only.
- `src/handlers/http/*` handles HTTP request/response concerns.
- `src/handlers/mcp/*` handles MCP arguments and responses.
- `src/services/*` contains reusable logic shared by HTTP and MCP.
- `src/clients/osm_client.ts` owns direct OSM API calls.

When adding functionality, put the business logic in `services` first, then call it from HTTP and MCP handlers.

## Azure OpenAI

The suggestion endpoints use the `openai` package with Azure identity bearer tokens. Required settings:

- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_DEPLOYMENT`
- `AZURE_OPENAI_API_VERSION`, usually `v1`
- Optional `AZURE_OPENAI_SCOPE`, defaulting to `https://ai.azure.com/.default`

In local development the service uses `DefaultAzureCredential`. Outside development it uses `ManagedIdentityCredential`.

## Notes

- The app is intentionally prompt-free for OSM functions; function inputs use concrete IDs and structured JSON.
- Badge record updates accept JSON bodies even though OSM itself expects form data.
- `picture` is not sent when linking badges to events.
- Clean builds matter because stale generated function files in `dist/functions` can break indexing.
