# OpenClaw Setup Guide — Personal Learning Hub MCP

This guide walks you through connecting OpenClaw to the Personal Learning Hub's remote MCP server.

## Prerequisites

1. **Backend deployed** to Render (see `docs/deployment.md`)
2. **OpenClaw installed locally** with MCP support
3. **MCP Bearer token** from your Render environment variables (`MCP_BEARER_TOKEN`)

---

## Step 1: Verify Backend Deployment

Confirm your API is reachable:

```bash
curl https://wonder-bites-api.onrender.com/healthz
# Expected: {"status":"ok"}

curl https://wonder-bites-api.onrender.com/readyz
# Expected: {"status":"ready","database":"connected"}
```

---

## Step 2: Get Your MCP Bearer Token

From the Render dashboard, navigate to your `wonder-bites-api` service → Environment, and copy the value of `MCP_BEARER_TOKEN`.

You will use this as the Bearer token when adding the MCP server to OpenClaw.

---

## Step 3: Add the Remote MCP Server to OpenClaw

OpenClaw connects to MCP servers via Streamable HTTP. The endpoint is:

```
https://wonder-bites-api.onrender.com/mcp
```

### Using the OpenClaw CLI

Check your OpenClaw version first:

```bash
openclaw --version
```

Then add the remote MCP server. The exact command depends on your OpenClaw version:

**OpenClaw 0.5+:**
```bash
openclaw mcp add wonder-bites \
  --url https://wonder-bites-api.onrender.com/mcp \
  --header "Authorization: Bearer <MCP_BEARER_TOKEN>" \
  --transport streamable-http
```

**OpenClaw 0.4.x:**
```bash
openclaw mcp add wonder-bites \
  --endpoint https://wonder-bites-api.onrender.com/mcp \
  --bearer-token <MCP_BEARER_TOKEN>
```

**OpenClaw 0.3.x and earlier:**
```bash
openclaw mcp connect wonder-bites \
  https://wonder-bites-api.onrender.com/mcp \
  --token <MCP_BEARER_TOKEN>
```

> If you're unsure which command your version supports, run `openclaw mcp --help` or `openclaw --help`.

### Using the OpenClaw GUI

1. Open OpenClaw settings → MCP Servers
2. Click "Add Server"
3. Name: `wonder-bites`
4. URL: `https://wonder-bites-api.onrender.com/mcp`
5. Transport: Streamable HTTP
6. Auth header: `Authorization: Bearer <MCP_BEARER_TOKEN>`
7. Save and connect

---

## Step 4: Verify Connection

In OpenClaw, list available tools to confirm discovery:

```bash
openclaw mcp list wonder-bites
```

You should see all 16 tools:

| Tool | Capability |
|---|---|
| `list_workflows` | Read — list all 7 workflows |
| `get_workflow` | Read — single workflow details |
| `search_content_history` | Read — full-text content search |
| `get_content_entry` | Read — entry by ID |
| `get_recent_entries` | Read — recent entries with lookback |
| `get_reading_list` | Read — user's reading list |
| `get_next_workflow_context` | Read — context for next generation |
| `get_workflow_run_status` | Read — run status by ID |
| `get_dashboard_summary` | Read — dashboard metrics |
| `publish_content_entry` | Write — create new entry (idempotent) |
| `update_content_entry` | Write — update entry (creates revision) |
| `save_to_reading_list` | Write — save entry to reading list |
| `update_reading_status` | Write — mark saved/reading/completed |
| `add_personal_note` | Write — add note to reading list item |
| `start_workflow_run` | Write — claim execution record |
| `complete_workflow_run` | Write — mark run succeeded/failed |

---

## Step 5: Test Workflow — Publish → Read → Complete

Run this end-to-end test in OpenClaw:

### 1. Publish a content entry

```bash
openclaw mcp call wonder-bites publish_content_entry \
  --workflowSlug science-signal \
  --title "Test Entry: Quantum Entanglement" \
  --summary "A brief test entry to verify MCP publishing." \
  --contentMarkdown "# Quantum Entanglement\n\nThis is a test entry published via MCP." \
  --category "Physics" \
  --tags '["quantum","physics","test"]' \
  --idempotencyKey "test-publish-001"
```

### 2. Verify it appears on the dashboard

```bash
openclaw mcp call wonder-bites get_dashboard_summary
```

Check that `totalEntries` is at least 1.

### 3. Save to reading list

```bash
openclaw mcp call wonder-bites get_recent_entries \
  --workflowSlugs '["science-signal"]' \
  --lookbackDays 1 \
  --limit 5
```

Copy the `id` of the entry you just published, then:

```bash
openclaw mcp call wonder-bites save_to_reading_list \
  --contentEntryId <ENTRY_ID>
```

### 4. Mark as completed

```bash
openclaw mcp call wonder-bites update_reading_status \
  --contentEntryId <ENTRY_ID> \
  --status completed
```

### 5. Verify in reading list

```bash
openclaw mcp call wonder-bites get_reading_list \
  --status completed
```

The entry should appear with status `completed`.

---

## Step 6: Schedule Configuration for All 7 Workflows

Workflows are pre-seeded with default schedules (all times Asia/Kolkata):

| Workflow | Default Schedule | Description |
|---|---|---|
| `weekly-coding-challenge` | `0 9 * * 1` | Monday 9:00 AM |
| `facts-and-quotes` | `0 7 * * *` | Daily 7:00 AM |
| `concept-of-the-day` | `0 8 * * *` | Daily 8:00 AM |
| `mind-signal` | `30 8 * * *` | Daily 8:30 AM |
| `daily-random-project-ideas` | `0 9 * * *` | Daily 9:00 AM |
| `science-signal` | `0 10 * * *` | Daily 10:00 AM |
| `math-practice` | `0 11 * * *` | Daily 11:00 AM |

To adjust a schedule via the Render dashboard or API:

```bash
PATCH /api/v1/workflows/:slug
Body: { "scheduleExpression": "0 12 * * *", "enabled": true }
```

Or via the frontend Settings page → Workflow Automation Schedules.

---

## Troubleshooting

| Issue | Solution |
|---|---|
| Connection refused / timeout | Verify the Render API URL is correct and the service is awake (Render free tier spins down) |
| 401 Unauthorized | Verify `MCP_BEARER_TOKEN` matches exactly; no extra spaces |
| Tools not discovered | Ensure the MCP server is running at `/mcp` and the bearer token is valid |
| Session errors | OpenClaw may need to re-establish the Streamable HTTP session; reconnect the server |
| `initialize` fails | Check that the server supports `2024-11-05` protocol version (the SDK handles this) |

---

## Support

- Backend health: `https://wonder-bites-api.onrender.com/healthz`
- MCP endpoint: `https://wonder-bites-api.onrender.com/mcp`
- Frontend: `https://wonder-bites.netlify.app`
