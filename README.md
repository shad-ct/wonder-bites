# Wonder Bites

Personal Learning Hub — an AI-powered content publishing platform with 7 automated learning workflows, a Fastify + MCP backend, a React frontend, and an OpenClaw agent environment.

```
┌─────────────────┐      HTTPS      ┌──────────────────────┐
│   Netlify (Web) │◄───────────────►│  Render (API)        │
│  (React SPA)    │                 │  (Fastify + MCP)     │
└─────────────────┘                 └──────────┬───────────┘
                                               │
                                      ┌────────▼────────┐
                                      │ Render          │
                                      │ PostgreSQL      │
                                      └─────────────────┘
```

## What's in the repo

| Path | Purpose |
|------|---------|
| `apps/api` | Fastify backend + MCP server (16 tools), Prisma ORM, 7 workflows |
| `apps/web` | React + Vite frontend (login, dashboard, reading list) |
| `packages/shared` | Shared Zod schemas, TypeScript types, workflow constants |
| `prisma/` | Prisma schema + seed script |
| `install and setup/` | One-shot environment installers (Linux `.sh`, Windows `.ps1`) |
| `docs/` | Deployment guide + OpenClaw setup guide |

The API exposes **16 MCP tools** over Streamable HTTP at `/mcp` (read + write) covering workflows, content entries, reading list, dashboard, and workflow-run lifecycle. See `apps/api/src/mcp/server.ts`.

## Prerequisites

- **Node.js** >= 20 (the installers target Node 24)
- **pnpm** >= 9 (`corepack enable` then `corepack prepare pnpm@latest --activate`)
- **Docker** or a local **PostgreSQL** database (for local dev)
- **Git**

## One-shot installers (new machine)

Use these to stand up the full local environment on another system — Node, OpenClaw, Ollama + models, the Wonder Bites MCP server, agents, gateway, and scheduled jobs.

| OS | File | How to run |
|----|------|------------|
| Linux (Debian/Ubuntu) | `install and setup/setup-linux.sh` | `bash "install and setup/setup-linux.sh"` |
| Windows 10/11 | `install and setup/setup-windows.ps1` | `powershell -ExecutionPolicy Bypass -File "install and setup\setup-windows.ps1"` |

Both scripts:
- are **idempotent** (safe to re-run — each step checks before changing anything),
- need `wonder-bites-jobs.json` next to the script (included in `install and setup/`),
- prompt once (hidden input) for your **Wonder Bites MCP token**, stored with restricted permissions,
- install Node 24, OpenClaw CLI, Ollama, pull default models (`qwen3:4b`, `qwen3:0.6b`, `gemma4:e2b`), onboard OpenClaw (local + Ollama), add the `wonder-bites` MCP server, create 4 agents (coordinator, researcher, writer, reviewer), install the gateway, and create scheduled jobs from the workflow schedules.

Open a **new terminal/PowerShell window** after running so PATH and environment variables are fully refreshed.

## Environment variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string (Prisma) | `postgresql://user:pass@localhost:5432/learning_hub?schema=public` |
| `DIRECT_URL` | Direct DB URL (for migrations/pooler) | same as above |
| `PORT` | API port | `3001` |
| `NODE_ENV` | `development` or `production` | `development` |
| `LOG_LEVEL` | Log level | `info` |
| `SESSION_SECRET` | Session signing secret (32+ chars) | `openssl rand -hex 32` |
| `MCP_BEARER_TOKEN` | Bearer token for MCP `/mcp` auth | `openssl rand -hex 32` |
| `INITIAL_USERNAME` | Seed admin username | `admin` |
| `INITIAL_USER_PASSWORD` | Seed admin password | change on first login |
| `FRONTEND_ORIGIN` | Allowed CORS origin | `http://localhost:5173` |
| `API_PUBLIC_URL` | Public API URL | `http://localhost:3001` |
| `RATE_LIMIT_MAX` | Rate limit max requests | `100` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window (ms) | `60000` |

Never commit `.env`. It is gitignored. For production (Render), set these as environment variables on the service dashboard instead of a `.env` file.

## Local development

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env
# edit .env with your DATABASE_URL and secrets

# 3. Generate Prisma client
pnpm db:generate

# 4. Run migrations + seed
pnpm db:migrate
pnpm db:seed

# 5. Start both API and web in parallel
pnpm dev
```

- API: `http://localhost:3001` (health: `/healthz`, ready: `/readyz`, MCP: `/mcp`)
- Web: `http://localhost:5173`

### Individual services

```bash
pnpm dev:api   # API only
pnpm dev:web   # Web only
```

### Build

```bash
pnpm build          # shared -> api + web
pnpm build:api      # shared + api
pnpm build:web      # shared + web
```

Start the built API:

```bash
pnpm start
```

## Testing & linting

```bash
pnpm test        # all packages
pnpm test:api    # API (vitest)
pnpm lint        # all packages
```

## Database

```bash
pnpm db:generate   # generate Prisma client
pnpm db:migrate    # create + apply a migration (dev)
pnpm db:push       # push schema without migrations
pnpm db:seed       # seed admin user + 7 workflows
pnpm db:studio     # Prisma Studio GUI
```

Seed creates:
- User: `admin` (password from `INITIAL_USER_PASSWORD`)
- 7 workflows: `weekly-coding-challenge`, `facts-and-quotes`, `concept-of-the-day`, `mind-signal`, `daily-random-project-ideas`, `science-signal`, `math-practice`

## Deployment

### Render (API + PostgreSQL)

1. Create a **Web Service** from this repo (`apps/api` is the entry via root `package.json` `start` script).
2. Create a **PostgreSQL** database; copy its `DATABASE_URL`.
3. Set environment variables on the Render service (see table above; do **not** hardcode secrets).
4. Render redeploys on push. Run migrations in the Render shell or connect via `psql`:
   ```bash
   npx prisma migrate deploy --schema=prisma/schema.prisma
   tsx prisma/seed.ts
   ```
5. Verify: `curl https://<api>.onrender.com/healthz` → `{"status":"ok"}`

MCP endpoint: `https://<api>.onrender.com/mcp` (auth: `Authorization: Bearer <MCP_BEARER_TOKEN>`).

### Netlify (Frontend)

1. Connect the repo to Netlify; build command `pnpm build:web`, publish directory `apps/web/dist`.
2. Set `VITE_API_URL` (or equivalent) to your Render API public URL.
3. Netlify deploys on push; SPA redirects handled by `netlify.toml`.

## OpenClaw / MCP agent setup

The installers handle local OpenClaw setup. To connect OpenClaw to a **remote** MCP server manually:

```bash
openclaw mcp add wonder-bites \
  --url https://<api>.onrender.com/mcp \
  --header "Authorization: Bearer <MCP_BEARER_TOKEN>" \
  --transport streamable-http
openclaw mcp configure wonder-bites --approval auto
openclaw mcp list wonder-bites   # should show 16 tools
```

OpenClaw onboarding (non-interactive, local + Ollama):

```bash
openclaw onboard --non-interactive --mode local --auth-choice ollama \
  --custom-model-id qwen3:4b --accept-risk --skip-health \
  --gateway-port 18789 --gateway-bind loopback
openclaw gateway install
openclaw gateway restart
```

## Workflow default schedules (Asia/Kolkata)

| Workflow | Cron | Time |
|----------|------|------|
| `weekly-coding-challenge` | `0 9 * * 1` | Mon 9:00 AM |
| `facts-and-quotes` | `0 7 * * *` | Daily 7:00 AM |
| `concept-of-the-day` | `0 8 * * *` | Daily 8:00 AM |
| `mind-signal` | `30 8 * * *` | Daily 8:30 AM |
| `daily-random-project-ideas` | `0 9 * * *` | Daily 9:00 AM |
| `science-signal` | `0 10 * * *` | Daily 10:00 AM |
| `math-practice` | `0 11 * * *` | Daily 11:00 AM |

Adjust via the frontend (Settings → Workflow Automation Schedules) or `PATCH /api/v1/workflows/:slug`.

## 16 MCP tools

Read: `list_workflows`, `get_workflow`, `search_content_history`, `get_content_entry`, `get_recent_entries`, `get_reading_list`, `get_next_workflow_context`, `get_workflow_run_status`, `get_dashboard_summary`.

Write: `publish_content_entry`, `update_content_entry`, `save_to_reading_list`, `update_reading_status`, `add_personal_note`, `start_workflow_run`, `complete_workflow_run`.

## Project structure

```
wonder-bites/
├── apps/
│   ├── api/          # Fastify + MCP server, Prisma services, routes
│   └── web/          # React + Vite frontend
├── packages/
│   └── shared/       # Zod schemas, TS types, workflow constants
├── prisma/           # schema.prisma + seed.ts
├── install and setup/
│   ├── setup-linux.sh
│   ├── setup-windows.ps1
│   └── wonder-bites-jobs.json
├── docs/             # deployment.md, openclaw-setup.md, openclaw-guide.md
├── tests/
├── .env.example
├── netlify.toml
├── render.yaml
├── package.json      # pnpm workspace root
└── README.md
```

## License

Private / internal project.
