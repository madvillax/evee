# Eve and Telegram migration

The active agent runtime is Vercel Eve 0.77.0. The earlier Node/Hono migration remains the application boundary; Eve replaces Mastra, and Telegram returns as a private linked channel.

## Request flow

```text
Web → Next.js proxy → Hono + Better Auth → workspace-scoped Eve client
Telegram → secret-verified Eve webhook → linked workspace caller
                                           ↓
                         Eve coordinator and four scoped specialists
                                           ↓
                         platform services → Turso and collectors
```

The web API never accepts a client-selected workspace, user, or Eve session ID. It resolves the signed-in workspace, signs a five-minute caller token, and stores the durable conversation ID and stream cursor keyed by workspace and auth user. The Eve HTTP channel checks that ownership on stream, continuation, and control requests. Concurrent web sends are bounded by a database lease.

The native Telegram channel checks the webhook secret before invoking the linking hook. Private messages are admitted only after matching the sender, chat, and saved connection to current workspace membership. New link identities are included in continuation addresses, preventing history reuse after relinking. Tool calls recheck membership and connection validity; final replies also check the live connection. Group chats and callback controls are disabled.

Connections exposes owner/admin actions to create a one-use, ten-minute deep link and disconnect. Only a SHA-256 digest of the random linking code is stored. Code consumption, membership checks, uniqueness checks, and connection creation happen in one database transaction.

## Data and rollout

`drizzle/0006_curved_karen_page.sql` creates `telegram_connections`, `telegram_link_codes`, and `copilot_sessions`. It does not drop old Discord tables or rename existing user columns. Applied migration history must remain intact. Old Discord identities cannot be treated as Telegram identities, so users explicitly link their Telegram accounts.

Back up the production database using the normal deployment procedure, apply committed migrations, build the service, then configure and register the Telegram webhook. The migration is validated against a throwaway database; production migration execution and hosting deployment are separate operational steps.

Mastra-specific tables can be archived after confirming they are no longer needed. Their conversation histories are not converted. No LangGraph or LangChain runtime is installed.

## Running schedules

The production Eve server owns `agent/schedules/monitor.ts` with `*/20 * * * *`. It calls deterministic collection and scoring services with database claims and bounded retries. Results remain in the workspace queue and are available through `/digest`. Pausing disables recurring scans; an explicit manual scan is still available.

`eve dev` never fires cron on its own. To test one scan tick locally while the development Eve service is running:

```bash
curl -X POST http://localhost:4001/eve/v1/dev/schedules/monitor
```

Use this only against a development database whose scans you intend to run. The route is absent from production.

## Runtime storage

Application data remains in Turso. Eve stores durable workflow history separately. A self-hosted instance needs persistent `.eve/.workflow-data`; hosted Vercel builds use the framework's Vercel workflow integration. Keep workflow callbacks reachable as well as the ordinary Eve routes. Build output must match the deployment environment.
