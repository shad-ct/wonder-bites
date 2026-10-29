# OpenClaw Guide — Personal Learning Hub (MCP)

**Website:** https://wonder-bites.netlify.app  
**API Base:** https://wonder-bites-api.onrender.com  
**MCP Endpoint:** https://wonder-bites-api.onrender.com/mcp  
**Repository:** https://github.com/shad-ct/wonder-bites  

---

## 1. Quick Access Credentials

| Item | Value |
|------|-------|
| **Frontend URL** | https://wonder-bites.netlify.app |
| **Login Username** | `admin` |
| **Login Password** | `YccMkanKyITtGTcZSdBQ` |
| **MCP Bearer Token** | `af1df3ce8a880f8cd75ffb86afeea7eb749199f01da21824ef88a146656becc5` |
| **MCP Endpoint** | `https://wonder-bites-api.onrender.com/mcp` |

---

## 2. How to Access the Website

1. Open **https://wonder-bites.netlify.app** in your browser
2. Click **Sign In**
3. Enter:
   - Username: `admin`
   - Password: `YccMkanKyITtGTcZSdBQ`
4. You'll land on the **Dashboard** showing your learning metrics

### What You Can Do on the Website

| Page | What It Does |
|------|--------------|
| **Dashboard** (`/`) | View your learning metrics: total entries, unread, completed, saved-for-later, today's entries, active workflows, latest executions, recent content |
| **Content Library** (`/library`) | Browse all your learning entries with search, filters (workflow, category, read status), pagination, and grid/list views |
| **Entry Detail** (`/library/:id`) | Read full markdown content with math rendering, save to reading list, mark as read/completed, add personal study notes, view revision history, export as markdown |
| **Read Later** (`/reading-list`) | Your personal reading queue with tabs for Saved / Reading / Completed, status transitions, personal notes, sort options |
| **Workflows** (`/workflows`) | View all 7 automated workflows with status, schedule, run metrics, pause/resume, and manual trigger |
| **Workflow Detail** (`/workflows/:slug`) | Deep dive into a single workflow: recent entries, run history, settings (cron schedule, timezone, enabled), export |
| **Execution History** (`/history`) | Filterable table of all workflow runs with status, timestamps, entries created, trigger source, error details |
| **Settings** (`/settings`) | Profile/timezone, theme (dark/light/system), workflow schedule configuration, export full library or reading list, system health |

---

## 3. How to Connect OpenClaw to This MCP Server

### Option A: OpenClaw CLI (version 0.5+)

```bash
openclaw mcp add wonder-bites \
  --url https://wonder-bites-api.onrender.com/mcp \
  --header "Authorization: Bearer af1df3ce8a880f8cd75ffb86afeea7eb749199f01da21824ef88a146656becc5" \
  --transport streamable-http
```

### Option B: OpenClaw CLI (version 0.4.x)

```bash
openclaw mcp add wonder-bites \
  --endpoint https://wonder-bites-api.onrender.com/mcp \
  --bearer-token af1df3ce8a880f8cd75ffb86afeea7eb749199f01da21824ef88a146656becc5
```

### Option C: OpenClaw GUI

1. Open OpenClaw → Settings → MCP Servers
2. Click **Add Server**
3. Fill in:
   - **Name:** `wonder-bites`
   - **URL:** `https://wonder-bites-api.onrender.com/mcp`
   - **Transport:** Streamable HTTP
   - **Auth Header:** `Authorization: Bearer af1df3ce8a880f8cd75ffb86afeea7eb749199f01da21824ef88a146656becc5`
4. Save & Connect

---

## 4. Verify Connection

After adding, run:

```bash
openclaw mcp list wonder-bites
```

You should see all **16 tools** listed below.

---

## 5. All 16 MCP Tools

### Read Tools (9)

| Tool | Description | Input |
|------|-------------|-------|
| `list_workflows` | Lists all 7 workflows with execution counts and last run status | `{}` |
| `get_workflow` | Single workflow details, config, schedule, last run | `{ "slug": "science-signal" }` |
| `search_content_history` | Full-text search across entries with filters | `{ "query": "...", "workflowSlug": "...", "category": "...", "tags": [...], "page": 1, "pageSize": 20 }` |
| `get_content_entry` | Full entry by UUID with markdown content | `{ "id": "uuid-here" }` |
| `get_recent_entries` | Recent entries across workflows with lookback window | `{ "workflowSlugs": [...], "lookbackDays": 7, "limit": 20 }` |
| `get_reading_list` | User's reading list items | `{ "status": "saved\|reading\|completed", "page": 1, "pageSize": 20 }` |
| `get_next_workflow_context` | Context for next generation (syllabus progress, recent topics, rotation) | `{ "workflowSlug": "math-practice" }` |
| `get_workflow_run_status` | Status of a specific workflow run by ID | `{ "runId": "uuid-here" }` |
| `get_dashboard_summary` | Real dashboard metrics from database | `{}` |

### Write Tools (7)

| Tool | Description | Input |
|------|-------------|-------|
| `publish_content_entry` | Create a new content entry with idempotency protection | `{ "workflowSlug": "...", "title": "...", "summary": "...", "contentMarkdown": "...", "category": "...", "tags": [...], "sourceUrls": [...], "idempotencyKey": "unique-key" }` |
| `update_content_entry` | Update an existing entry (creates a revision snapshot) | `{ "id": "uuid", "title": "...", "contentMarkdown": "...", ... }` |
| `save_to_reading_list` | Save an entry to the reading list (idempotent) | `{ "contentEntryId": "uuid" }` |
| `update_reading_status` | Mark entry as saved / reading / completed | `{ "contentEntryId": "uuid", "status": "completed" }` |
| `add_personal_note` | Add/update personal notes on a reading list item | `{ "contentEntryId": "uuid", "note": "my thoughts..." }` |
| `start_workflow_run` | Record the start of a workflow run (idempotent) | `{ "workflowSlug": "...", "idempotencyKey": "unique-key", "triggerSource": "mcp" }` |
| `complete_workflow_run` | Mark a workflow run as succeeded or failed | `{ "runId": "uuid", "status": "succeeded\|failed", "entriesCreated": 0 }` |

---

## 6. Example OpenClaw Workflow (End-to-End)

### Step 1: Publish a content entry via MCP

```bash
openclaw mcp call wonder-bites publish_content_entry \
  --workflowSlug science-signal \
  --title "My Test Entry" \
  --summary "Testing MCP publishing from OpenClaw." \
  --contentMarkdown "# Test Entry\n\nThis was published via OpenClaw MCP." \
  --category "Physics" \
  --tags '["quantum","test"]' \
  --idempotencyKey "openclaw-test-001"
```

### Step 2: Verify it shows on the dashboard

```bash
openclaw mcp call wonder-bites get_dashboard_summary
```
Check that `totalEntries` is at least 1.

### Step 3: Get the entry ID from recent entries

```bash
openclaw mcp call wonder-bites get_recent_entries \
  --workflowSlugs '["science-signal"]' \
  --lookbackDays 1 \
  --limit 5
```

Copy the `id` from the response.

### Step 4: Save to reading list

```bash
openclaw mcp call wonder-bites save_to_reading_list \
  --contentEntryId <ENTRY_ID_FROM_STEP_3>
```

### Step 5: Mark as completed

```bash
openclaw mcp call wonder-bites update_reading_status \
  --contentEntryId <ENTRY_ID_FROM_STEP_3> \
  --status completed
```

### Step 6: Verify in reading list

```bash
openclaw mcp call wonder-bites get_reading_list \
  --status completed
```

The entry should appear with status `completed`.

---

## 7. The 7 Workflows (Pre-Seeded)

| Workflow | Slug | Schedule (Asia/Kolkata) | Description |
|----------|------|------------------------|-------------|
| Weekly Coding Challenge | `weekly-coding-challenge` | `0 9 * * 1` (Mon 9AM) | Programming challenges, beginner to intermediate |
| Facts & Quotes | `facts-and-quotes` | `0 7 * * *` (Daily 7AM) | 5 facts + 5 quotes daily |
| Concept of the Day | `concept-of-the-day` | `0 8 * * *` (Daily 8AM) | One concept from Math/Physics/CS/Biology |
| Mind Signal | `mind-signal` | `30 8 * * *` (Daily 8:30AM) | Philosophy/psychology idea |
| Daily Random Project Ideas | `daily-random-project-ideas` | `0 9 * * *` (Daily 9AM) | 5 project ideas per day |
| Science Signal | `science-signal` | `0 10 * * *` (Daily 10AM) | Science/astronomy news |
| Math Practice | `math-practice` | `0 11 * * *` (Daily 11AM) | 32-module applied mathematics syllabus |

Adjust schedules via the website Settings page → Workflow Automation Schedules.

---

## 8. Troubleshooting

| Issue | Fix |
|-------|-----|
| **401 Unauthorized on MCP calls** | Verify you're sending `Authorization: Bearer af1df3ce8a880f8cd75ffb86afeea7eb749199f01da21824ef88a146656becc5` exactly |
| **MCP tools not discovered** | Ensure the Accept header includes `application/json, text/event-stream` |
| **Website won't load** | Check https://wonder-bites.netlify.app is reachable; login with `admin` / `YccMkanKyITtGTcZSdBQ` |
| **API health check fails** | Visit https://wonder-bites-api.onrender.com/healthz — should return `{"status":"ok"}` |
| **Database tables missing** | The API auto-runs migrations on startup; wait ~30s after deploy then retry |
| **OpenClaw can't connect** | Verify the MCP endpoint URL is exactly `https://wonder-bites-api.onrender.com/mcp` and bearer token is correct |

---

## 9. Support Links

- **Frontend:** https://wonder-bites.netlify.app
- **API Health:** https://wonder-bites-api.onrender.com/healthz
- **API Readiness:** https://wonder-bites-api.onrender.com/readyz
- **MCP Endpoint:** https://wonder-bites-api.onrender.com/mcp
- **Render Dashboard:** https://dashboard.render.com/web/srv-dbhb8hom7kps73ee1asg
- **Netlify Dashboard:** https://app.netlify.com/projects/wonder-bites
- **GitHub Repo:** https://github.com/shad-ct/wonder-bites
