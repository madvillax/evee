# Eve web runtime

The active agent runtime is Vercel Eve 0.77.0. Evee operates exclusively through its authenticated web workspace. Node/Hono remains the application boundary; Eve owns the Copilot and recurring scans.

## Request flow

```text
Web → Next.js proxy → Hono + Better Auth → workspace-scoped Eve client
                                           ↓
                         Eve coordinator and four scoped specialists
                                           ↓
                         platform services → Turso and collectors
```

The web API never accepts a client-selected workspace, user, or Eve session ID. It resolves the signed-in workspace, signs a five-minute caller token, and stores the durable conversation ID and stream cursor keyed by workspace and auth user. The Eve HTTP channel checks that ownership on stream, continuation, and control requests. Concurrent web sends are bounded by a database lease.

The protected Eve HTTP channel is the only configured conversation channel. Every agent tool requires an `evee-web` caller and rechecks current workspace membership. Previous bot callers cannot use tools or resume work through a messaging channel. Connections lists the available signal sources and links to the web queue and Copilot.

## Data and rollout

`drizzle/0006_curved_karen_page.sql` adds `copilot_sessions` and the now-archived Telegram linkage tables. Earlier Discord compatibility tables also remain. Applied migration history and archived link data stay intact; none of those links grant runtime access. Removing the bot requires no destructive database migration.

Apply committed migrations and rebuild the web app, API, and Eve service before restarting them. The build discovers only `agent/channels/eve.ts`; the Telegram webhook, linking API, registration script, and connection controls have been removed. Bot credentials and `EVE_PUBLIC_URL` are no longer needed. Production rollout remains a separate operational step.

Mastra-specific tables can be archived after confirming they are no longer needed. Their conversation histories are not converted. No LangGraph or LangChain runtime is installed.

## Running schedules

The production Eve server owns `agent/schedules/monitor.ts` with `*/20 * * * *`. It calls deterministic collection and scoring services with database claims and bounded retries. Results remain in the web opportunity queue. Pausing disables recurring scans; an explicit manual scan is still available from the web app.

`eve dev` never fires cron on its own. To test one scan tick locally while the development Eve service is running:

```bash
curl -X POST http://localhost:4001/eve/v1/dev/schedules/monitor
```

Use this only against a development database whose scans you intend to run. The route is absent from production.

## Runtime storage

Application data remains in Turso. Eve stores durable workflow history separately. A self-hosted instance needs persistent `.eve/.workflow-data`; hosted Vercel builds use the framework's Vercel workflow integration. Keep workflow callbacks reachable as well as the ordinary Eve routes. Build output must match the deployment environment.
