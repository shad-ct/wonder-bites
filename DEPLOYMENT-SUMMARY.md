# Personal Learning Hub — Deployment Summary

**Date:** Thursday, October 29, 2026  
**Repository:** https://github.com/shad-ct/wonder-bites  
**Deployed by:** adel devs (adeldevs87@gmail.com)

---

## 1. Architecture Overview

```
┌─────────────────────┐      HTTPS      ┌──────────────────────┐
│   Netlify (Web)     │◄───────────────►│  Render (API)        │
│   (frontend SPA)    │                 │  (Fastify + MCP)     │
│  wonder-bites.netlify.app│           │ wonder-bites-api.onrender.com│
└─────────────────────┘                 └──────────┬───────────┘
                                                   │
                                           ┌───────▼────────┐
                                           │ Render         │
                                           │ PostgreSQL     │
                                           │ (wonder-bites-db)│
                                           └────────────────┘
```

---

## 2. Deployed Services & Links

| Resource | Name | URL / ID | Region | Plan | Status |
|---|---|---|---|---|---|
| **Frontend** | wonder-bites | https://wonder-bites.netlify.app | — | Free | ✅ Live |
| **Backend API** | wonder-bites-api | https://wonder-bites-api.onrender.com | Oregon | Free | ✅ Live (migrations + seeded) |
| **Database** | wonder-bites-db | `dpg-dbhb7j142hec73bvabqg-a` | Oregon | Free | ✅ Available (schema pushed + seeded) |
| **GitHub Repo** | shad-ct/wonder-bites | https://github.com/shad-ct/wonder-bites | — | — | ✅ Public |

### Key Endpoints

| Endpoint | URL | Purpose |
|---|---|---|
| Frontend (login/dashboard) | https://wonder-bites.netlify.app | React SPA |
| API Health Check | https://wonder-bites-api.onrender.com/healthz | Returns `{"status":"ok"}` |
| API Readiness Check | https://wonder-bites-api.onrender.com/readyz | Confirms DB connection |
| MCP Streamable HTTP | https://wonder-bites-api.onrender.com/mcp | MCP server for OpenClaw |
| Render Dashboard (API) | https://dashboard.render.com/web/srv-dbhb8hom7kps73ee1asg | Configure env vars |
| Render Dashboard (DB) | https://dashboard.render.com/d/dpg-dbhb7j142hec73bvabqg-a | Get DATABASE_URL |
| Netlify Dashboard | https://app.netlify.com/projects/wonder-bites | Site settings & deploys |

---

## 3. Credentials & Secrets

### Copy-Paste These Into Render Dashboard

Go to **https://dashboard.render.com/web/srv-dbhb8hom7kps73ee1asg → Environment**

Add each variable below as a separate key-value pair:

| Key | Value | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://wonder_bites:b9vvWZLdEMH3EFOOlPZzdwwa1hFgXWNQ@dpg-dbhb7j142hec73bvabqg-a.oregon-postgres.render.com/wonder_bites` | Already set |
| `DIRECT_URL` | `postgresql://wonder_bites:b9vvWZLdEMH3EFOOlPZzdwwa1hFgXWNQ@dpg-dbhb7j142hec73bvabqg-a.oregon-postgres.render.com/wonder_bites` | Already set |
| `NODE_ENV` | `production` | Already set |
| `PORT` | `3001` | Already set |
| `SESSION_SECRET` | `bb0ccaf8e4032e53caad0620202c48fe2f6ac810cc33e9e30210d9102fd483ac` | Already set |
| `MCP_BEARER_TOKEN` | `af1df3ce8a880f8cd75ffb86afeea7eb749199f01da21824ef88a146656becc5` | Already set; used by OpenClaw |
| `INITIAL_USERNAME` | `admin` | Already set |
| `INITIAL_USER_PASSWORD` | `YccMkanKyITtGTcZSdBQ` | Already set |
| `FRONTEND_ORIGIN` | `https://wonder-bites.netlify.app` | Already set |
| `API_PUBLIC_URL` | `https://wonder-bites-api.onrender.com` | Already set |
| `LOG_LEVEL` | `info` | Already set |
| `RATE_LIMIT_MAX` | `100` | Already set |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Already set |

### Get DATABASE_URL (already have it)

Use this exact value for `DATABASE_URL` (and `DIRECT_URL`):

```
postgresql://wonder_bites:b9vvWZLdEMH3EFOOlPZzdwwa1hFgXWNQ@dpg-dbhb7j142hec73bvabqg-a.oregon-postgres.render.com/wonder_bites
```

**DB details:**
- Host: `dpg-dbhb7j142hec73bvabqg-a.oregon-postgres.render.com`
- Port: `5432`
- Database: `wonder_bites`
- Username: `wonder_bites`
- Password: `b9vvWZLdEMH3EFOOlPZzdwwa1hFgXWNQ`

### After Saving

Click **Save Changes** — Render will automatically redeploy the API service.


---

## 4. How to Access the Application

### Step 1: Render Backend Configuration (Already Complete)

All environment variables are set on the Render dashboard at https://dashboard.render.com/web/srv-dbhb8hom7kps73ee1asg → Environment. The API has been redeployed and is live.

Verify:
```bash
curl https://wonder-bites-api.onrender.com/healthz
# Expected: {"status":"ok"}

curl https://wonder-bites-api.onrender.com/readyz
# Expected: {"status":"ready","database":"connected"}
```

### Step 2: Run Database Migrations & Seed

Once the API is running (health check returns `{"status":"ok"}`), run migrations and seed:

```bash
# Option A: Local (you need DATABASE_URL)
export DATABASE_URL="<from Render DB dashboard>"
npx prisma migrate deploy --schema=prisma/schema.prisma
tsx prisma/seed.ts

# Option B: Via Render shell (if available)
# Connect to the Render service shell and run the same commands
```

The seed script creates:
- **User:** `admin` with password you set via `INITIAL_USER_PASSWORD`
- **7 Workflows:** weekly-coding-challenge, facts-and-quotes, concept-of-the-day, mind-signal, daily-random-project-ideas, science-signal, math-practice

### Step 3: Access the Frontend

1. Open **https://wonder-bites.netlify.app**
2. Log in with:
   - **Username:** `admin`
   - **Password:** whatever you set for `INITIAL_USER_PASSWORD`

### Step 4: Access the MCP Endpoint

The MCP server is at: **https://wonder-bites-api.onrender.com/mcp**

Authentication: `Authorization: Bearer af1df3ce8a880f8cd75ffb86afeea7eb749199f01da21824ef88a146656becc5`

---

## 5. OpenClaw Setup — Connect to This MCP Server

### Prerequisites

- OpenClaw installed locally with MCP support
- Backend deployed and health check passing
- `MCP_BEARER_TOKEN` value copied (see Section 3)

### Step 1: Verify Backend is Reachable

```bash
curl https://wonder-bites-api.onrender.com/healthz
# Expected: {"status":"ok"}

curl https://wonder-bites-api.onrender.com/readyz
# Expected: {"status":"ready","database":"connected"}
```

### Step 2: Check Your OpenClaw Version

```bash
openclaw --version
```

### Step 3: Add the Remote MCP Server

The MCP endpoint URL is:

```
https://wonder-bites-api.onrender.com/mcp
```

**OpenClaw 0.5+ (CLI):**
```bash
openclaw mcp add wonder-bites \
  --url https://wonder-bites-api.onrender.com/mcp \
  --header "Authorization: Bearer af1df3ce8a880f8cd75ffb86afeea7eb749199f01da21824ef88a146656becc5" \
  --transport streamable-http
```

**OpenClaw 0.4.x:**
```bash
openclaw mcp add wonder-bites \
  --endpoint https://wonder-bites-api.onrender.com/mcp \
  --bearer-token af1df3ce8a880f8cd75ffb86afeea7eb749199f01da21824ef88a146656becc5
```

**OpenClaw GUI:**
1. Settings → MCP Servers → Add Server
2. Name: `wonder-bites`
3. URL: `https://wonder-bites-api.onrender.com/mcp`
4. Transport: Streamable HTTP
5. Auth header: `Authorization: Bearer af1df3ce8a880f8cd75ffb86afeea7eb749199f01da21824ef88a146656becc5`
6. Save & connect

### Step 4: Verify Tool Discovery

```bash
openclaw mcp list wonder-bites
```

You should see all **16 tools**:

| Tool | Category | Purpose |
|---|---|---|
| `list_workflows` | Read | List all 7 workflows with run stats |
| `get_workflow` | Read | Single workflow details |
| `search_content_history` | Read | Full-text search across entries |
| `get_content_entry` | Read | Entry by UUID |
| `get_recent_entries` | Read | Recent entries with lookback window |
| `get_reading_list` | Read | User's reading list items |
| `get_next_workflow_context` | Read | Context for next generation run |
| `get_workflow_run_status` | Read | Workflow run status by ID |
| `get_dashboard_summary` | Read | Dashboard metrics |
| `publish_content_entry` | Write | Create new entry (idempotent) |
| `update_content_entry` | Write | Update entry (creates revision) |
| `save_to_reading_list` | Write | Save entry to reading list |
| `update_reading_status` | Write | Mark saved/reading/completed |
| `add_personal_note` | Write | Add note to reading list item |
| `start_workflow_run` | Write | Claim execution record |
| `complete_workflow_run` | Write | Mark run succeeded/failed |

### Step 5: End-to-End Test Cycle

**1. Publish a content entry:**
```bash
openclaw mcp call wonder-bites publish_content_entry \
  --workflowSlug science-signal \
  --title "OpenClaw Test Entry" \
  --summary "Verifying MCP publishing via OpenClaw." \
  --contentMarkdown "# Test Entry\n\nPublished via OpenClaw MCP." \
  --category "Physics" \
  --tags '["quantum","test"]' \
  --idempotencyKey "openclaw-test-001"
```

**2. Verify on dashboard:**
```bash
openclaw mcp call wonder-bites get_dashboard_summary
```
Check `totalEntries` is at least 1.

**3. Save to reading list:**
```bash
# First get the entry ID from recent entries
openclaw mcp call wonder-bites get_recent_entries \
  --workflowSlugs '["science-signal"]' \
  --lookbackDays 1 \
  --limit 5

# Then save it (replace <ENTRY_ID> with the returned id)
openclaw mcp call wonder-bites save_to_reading_list \
  --contentEntryId <ENTRY_ID>
```

**4. Mark as completed:**
```bash
openclaw mcp call wonder-bites update_reading_status \
  --contentEntryId <ENTRY_ID> \
  --status completed
```

**5. Verify in reading list:**
```bash
openclaw mcp call wonder-bites get_reading_list \
  --status completed
```

---

## 6. Workflow Default Schedules (Asia/Kolkata)

| Workflow | Schedule | Description |
|---|---|---|
| `weekly-coding-challenge` | `0 9 * * 1` | Monday 9:00 AM |
| `facts-and-quotes` | `0 7 * * *` | Daily 7:00 AM |
| `concept-of-the-day` | `0 8 * * *` | Daily 8:00 AM |
| `mind-signal` | `30 8 * * *` | Daily 8:30 AM |
| `daily-random-project-ideas` | `0 9 * * *` | Daily 9:00 AM |
| `science-signal` | `0 10 * * *` | Daily 10:00 AM |
| `math-practice` | `0 11 * * *` | Daily 11:00 AM |

Adjust via frontend: Settings → Workflow Automation Schedules, or via API `PATCH /api/v1/workflows/:slug`.

---

## 7. Troubleshooting

| Issue | Likely Cause | Fix |
|---|---|---|
| API health check fails | Missing `DATABASE_URL` | Set on Render dashboard, redeploy |
| Frontend shows CORS error | `FRONTEND_ORIGIN` mismatch | Set to `https://wonder-bites.netlify.app` on Render |
| 401 on MCP calls | Wrong `MCP_BEARER_TOKEN` | Verify token matches Section 3 |
| Build fails on Render | Missing `start` script | Already fixed in repo (root `package.json`) |
| OpenClaw can't connect | Bearer token missing/malformed | Check `Authorization: Bearer <token>` header |
| Seed user not created | `INITIAL_USER_PASSWORD` not set | Set on Render dashboard, run `tsx prisma/seed.ts` |

---

## 8. Files Created/Modified in This Deployment

### New Files
- `render.yaml` — Render blueprint (IaC)
- `netlify.toml` — Netlify build config with SPA redirects
- `docs/deployment.md` — Deployment guide
- `docs/openclaw-setup.md` — OpenClaw MCP connection guide
- `tests/e2e/personal-learning-hub.spec.ts` — Playwright E2E test stub

### Modified Files
- `package.json` — Added root `start` script for Render
- `.gitignore` — Added `.netlify/` directory

---

## 9. Next Steps

1. [ ] Set `DATABASE_URL` and all env vars on Render dashboard
2. [ ] Run `prisma migrate deploy` and `tsx prisma/seed.ts`
3. [ ] Verify health check at `https://wonder-bites-api.onrender.com/healthz`
4. [ ] Log into frontend at `https://wonder-bites.netlify.app` with `admin`
5. [ ] Connect OpenClaw using the MCP bearer token
6. [ ] Run the publish → read → complete test cycle (Section 5)
7. [ ] Adjust workflow schedules as needed in Settings
