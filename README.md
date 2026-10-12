# Evee

Evee finds relevant public conversations, explains the evidence, and drafts useful replies for human review. Use the authenticated web workspace or its linked private Telegram bot. Evee never publishes a public reply on your behalf.

## Stack

- Next.js, React, and Tailwind for profiles, monitors, opportunities, settings, and Copilot
- Node.js and Hono for Better Auth, workspace authorization, scans, feedback, and Copilot streaming
- [Vercel Eve](https://vercel.com/eve) for durable agent conversations, four specialists, Telegram webhooks, and recurring scans
- Direct Gemini model access through the AI SDK; Google Gen AI SDK for structured opportunity analysis
- Turso and Drizzle for application data; npm workspaces and Turborepo

Mastra has been removed. LangGraph and LangChain are not dependencies. Discord has no active bot, routes, or credentials. Its historical migrations and compatibility tables remain to preserve existing data.

## Setup

Use Node.js 24 and npm 11+. From the repository root:

```bash
npm install
cp .env.example .env
```

Configure `.env`:

```dotenv
API_PORT=4000
API_INTERNAL_URL=http://localhost:4000
WEB_ORIGINS=http://localhost:3001
BETTER_AUTH_URL=http://localhost:3001
BETTER_AUTH_SECRET=replace-with-a-long-random-secret
GEMINI_API_KEY=your-google-ai-studio-key
GEMINI_MODEL=gemini-2.5-flash
TURSO_DATABASE_URL=file:local.db
TURSO_AUTH_TOKEN=
EVE_PORT=4001
EVE_INTERNAL_URL=http://localhost:4001
EVE_SERVICE_SECRET=replace-with-another-long-random-secret
```

Generate each secret separately with `openssl rand -base64 32`. The same `EVE_SERVICE_SECRET` must be present in Hono and Eve. It signs short-lived, server-generated workspace credentials; it is never sent to the browser.

Apply migrations and start:

```bash
npm run db:migrate
npm run dev
```

This starts the web app on `http://localhost:3001`, Hono on `http://localhost:4000`, and Eve on `http://localhost:4001`. Create an account and complete your business profile. Use **Scan now** or the Copilot. Collected opportunities stay available in the web queue.

## Telegram bot

Create a bot with Telegram's BotFather. Add these values to `.env` and the Eve production environment:

```dotenv
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
TELEGRAM_WEBHOOK_SECRET_TOKEN=
EVE_PUBLIC_URL=https://your-agent-service.example.com
```

`TELEGRAM_BOT_USERNAME` is the bot username without `@`. Generate the webhook secret with `openssl rand -hex 32`. Set `EVE_PUBLIC_URL` to the public HTTPS origin of the **Eve service**. Telegram cannot reach a localhost URL; local testing needs an HTTPS tunnel to port 4001. Keep these variables in Hono and Next.js too, so Connections can report whether the bot is configured.

With the agent service running and publicly reachable, register the webhook:

```bash
npm run telegram:webhook
```

The script registers `/eve/v1/telegram` and message updates only. It does not discard pending updates. Registration is explicit so local development does not take over a production bot's webhook.

In Evee, open **Connections → Telegram → Connect Telegram**, open the generated link, and press **Start**. Links expire in ten minutes and can be used once. An owner or admin must create them. The bot supports:

- `/scan`: scan configured sources
- `/digest`: read the latest qualified opportunities
- `/pause` and `/resume`: change automated monitoring
- Ordinary questions about the linked workspace, monitoring, or reply drafts

Only private chats with the linked user can access workspace data. Disconnect from Connections to revoke access. Relinking starts new bot history. Telegram is a companion to the web workspace; account creation and business-profile setup happen on the web.

## Agent layout

```text
apps/api/                    authenticated Node + Hono API
apps/web/                    Next.js workspace
apps/worker/                 starts the Eve service through its supported CLI
packages/agents/
  agent/instructions.md      GTM coordinator behavior
  agent/agent.ts             Gemini model and session limits
  agent/channels/            protected web protocol and native Telegram channel
  agent/subagents/           intelligence, monitoring, automation, drafting
  agent/schedules/monitor.ts twenty-minute scan schedule
  src/                       scoped tools, web relay, monitoring service
packages/platform/           collectors, analysis, Drizzle, linking services
packages/auth/               Better Auth
```

Eve owns durable session history and streaming. Hono resolves the web session and workspace, then uses the Eve client to continue a server-owned conversation. Every agent tool checks the caller's current workspace membership. Shell, file, and root-copy agent tools are disabled; each specialist gets only its own application tools.

The production scan schedule runs every twenty minutes for onboarded workspaces with monitoring enabled. It uses bounded concurrency, retries, and database claims. It writes opportunities to the queue; users retrieve them through `/digest` or the web. `eve dev` does not run cron automatically. For local scans, use **Scan now**, `/scan`, or the dev schedule endpoint described in [the migration notes](docs/eve-telegram-migration.md).

## Build and production

```bash
npm run typecheck
npm test
npm run build
npm run start          # Hono API
npm run start:web      # Next.js (separate process)
npm run worker         # built Eve service (separate process)
```

Build before starting the production worker. Set `EVE_INTERNAL_URL` to the private or public Eve origin accessible from Hono. Set `API_INTERNAL_URL` in Next.js to the Hono origin. Preserve exact authenticated web origins in `WEB_ORIGINS` and configure production Better Auth URLs and secrets.

Eve can run as a Node service or deploy independently to Vercel from `packages/agents`. For a Vercel-hosted service use a shared remote Turso database, set the same environment variables, and follow Eve's bundled deployment guide. No hosting deployment is performed by this migration.

For self-hosting, persist `packages/agents/.eve/.workflow-data` and forward both `/eve/` and `/.well-known/workflow/` through the reverse proxy without rewriting their paths. Schedules run when serving a production build with `eve start`, which `npm run worker` invokes. Just-bash provides portable virtual workspace storage; this agent does not expose shell or file tools.

Apply the additive `0006` migration before serving the new Connections page or Copilot. Old Mastra conversation history is not imported into Eve. Application profiles, monitors, opportunities, feedback, and authentication data remain in Turso.
