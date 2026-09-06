# Web-first migration

## Target architecture

Evee is moving from a chat-channel companion with a dashboard to a web application with a dedicated backend:

```text
Browser
  -> Next.js web app
       -> same-origin API proxy
            -> Node + Hono API
                 -> Better Auth
                 -> platform services and Turso
                 -> Mastra Copilot

Node worker
  -> scheduled monitor workflow
       -> platform collectors and analysis
       -> web opportunity queue
```

## Phase 1: active in this change

- Make npm and Node the repository runtime and package workflow.
- Add the Hono API and mount Better Auth on it.
- Move Copilot streaming, on-demand scans, opportunity reads, and feedback writes behind authenticated Hono routes.
- Remove Telegram/Discord application code, routes, credentials, UI, and scheduled delivery.
- Scan every opted-in, onboarded web workspace instead of only chat-connected users.
- Surface new-opportunity counts in web navigation and add a direct **Scan now** action.

## Phase 2: next

- Move business-profile, monitor CRUD, settings, dashboard, analytics, and billing reads/actions from Next.js into Hono.
- Add a typed API client shared by server and client components.
- Add pagination and filters to the opportunity queue.
- Add durable in-app notification read state instead of deriving the badge from opportunity status.

## Phase 3: compatibility cleanup

- Back up and audit existing production data.
- Rebuild the legacy `users` table without chat identity columns.
- Remove legacy Discord connection, link-code, and digest tables.
- Delete legacy Discord integration rows after confirming no product or reporting dependency remains.

The compatibility cleanup is intentionally separate because it destroys old linkage data and requires a production-safe Drizzle migration with backup and rollback verification.
