# OSM Functions API and MCP Tools

Azure Functions app for working with Online Scout Manager (OSM). It exposes the same core OSM logic through HTTP endpoints and MCP tools, so regular API calls and agent/tool calls stay consistent.

## What It Does

- Starts and completes OSM OAuth, storing tokens in Azure Key Vault.
- Reads sections, terms, scouts, events, badges, badge requirements, and attendance.
- Links badge requirements to events.
- Updates badge records from JSON API requests.
- Suggests badge requirement matches using Azure OpenAI.
- Exposes MCP tools for agents, including a `get_today` helper so agents do not guess the current date.

## Requirements

- Node.js
- Azure Functions Core Tools v4
- Access to an Azure Key Vault
- Azure identity access for Key Vault secrets
- OSM OAuth app credentials
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
    "AZURE_KEY_VAULT_NAME": "<key-vault-name>",
    "OSM_REDIRECT_URI": "https://localhost:7071/api/osm/auth/callback",
    "AZURE_OPENAI_ENDPOINT": "<azure-openai-or-foundry-endpoint>",
    "AZURE_OPENAI_DEPLOYMENT": "<deployment-name>",
    "AZURE_OPENAI_API_VERSION": "v1"
  }
}
```

Required Key Vault secrets:

- `osm-client-id`
- `osm-client-secret`
- `osm-token` after OAuth completes
- `osm-oauth-state` is written during OAuth

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

## First-Time OSM Auth

1. Start the function app.
2. Open:

```text
https://localhost:7071/api/osm/auth
```

3. Follow the OSM authorization URL.
4. OSM redirects to:

```text
https://localhost:7071/api/osm/auth/callback
```

5. The callback exchanges the authorization code and stores the token in Key Vault as `osm-token`.

## HTTP Endpoints

Base URL locally:

```text
https://localhost:7071/api
```

Read endpoints:

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/osm/auth` | Start OSM OAuth |
| GET | `/osm/auth/callback` | Complete OSM OAuth |
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
