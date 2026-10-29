# Deployment Guide — Personal Learning Hub

This document covers deploying the Personal Learning Hub to Render (backend + PostgreSQL) and Netlify (frontend).

## Prerequisites

- **Render account** — [render.com](https://render.com)
- **Netlify account** — [netlify.com](https://netlify.com)
- **Node.js 20 LTS** and **pnpm 9.x** locally (for local development)

## Architecture

```
┌─────────────────┐      HTTPS      ┌──────────────────┐
│  Netlify (Web)  │◄───────────────►│ Render (API)     │
│   (frontend)    │                 │ (Fastify + MCP)  │
└─────────────────┘                 └─────────┬────────┘
                                              │
                                      ┌───────▼───────┐
                                      │ Render        │
                                      │ PostgreSQL    │
                                      │ (managed DB)  │
                                      └───────────────┘
```

---

## Step 1: Render Backend + PostgreSQL

### Option A: Using `render.yaml` (Infrastructure as Code)

1. In the Render dashboard, create a new **Blueprint** instance.
2. Connect your GitHub repository (`wonder-bites`).
3. Render will detect `render.yaml` and propose:
   - A **Web Service** (`wonder-bites-api`) — Node.js
   - A **PostgreSQL** database (`wonder-bites-db`)
4. Review and apply the blueprint.

### Option B: Manual Setup

1. **Create a PostgreSQL database** in Render:
   - Name: `wonder-bites-db`
   - Plan: Starter (or higher for production)
   - Enable SSL (default on Render managed PostgreSQL)

2. **Create a Web Service**:
   - Runtime: Node
   - Build command: `pnpm build:api`
   - Start command: `pnpm start`
   - Health check path: `/healthz`
   - Auto-deploy: enabled

3. **Set environment variables** in the Render dashboard:

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | Provided by Render DB |
| `DIRECT_URL` | Direct connection (for migrations) | Same as DATABASE_URL |
| `NODE_ENV` | Environment | `production` |
| `PORT` | Port to listen on | `3001` |
| `SESSION_SECRET` | Session signing secret (32+ chars) | Generate random |
| `MCP_BEARER_TOKEN` | Bearer token for MCP clients | Generate random |
| `INITIAL_USERNAME` | Seed user username | `admin` |
| `INITIAL_USER_PASSWORD` | Seed user password | Set a strong password |
| `FRONTEND_ORIGIN` | Netlify frontend URL | `https://your-site.netlify.app` |
| `API_PUBLIC_URL` | Public API URL | `https://wonder-bites-api.onrender.com` |
| `LOG_LEVEL` | Log level | `info` |
| `RATE_LIMIT_MAX` | Rate limit max requests | `100` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window (ms) | `60000` |

4. **Run migrations** — Render automatically runs `prisma migrate deploy` on deploy if you set it as a release command. Alternatively, connect via the Render shell and run:
   ```bash
   npx prisma migrate deploy --schema=prisma/schema.prisma
   ```

5. **Seed the database** (initial user + 7 workflows):
   ```bash
   pnpm db:seed
   ```

---

## Step 2: Netlify Frontend

1. In the Netlify dashboard, create a new site from your GitHub repository.
2. Configure build settings:
   - Base directory: `apps/web`
   - Build command: `pnpm build`
   - Publish directory: `dist`
3. Set environment variable:
   - `VITE_API_URL` = `https://wonder-bites-api.onrender.com`
4. Deploy. Netlify will detect `_redirects` for SPA fallback.

The `_redirects` file at `apps/web/public/_redirects`:
```
/*  /index.html  200
```

---

## Step 3: Connect Frontend to Backend

1. Update `FRONTEND_ORIGIN` in Render to match your Netlify URL.
2. Update `VITE_API_URL` in Netlify to match your Render API URL.
3. Redeploy both services.

---

## Step 4: Verify Deployment

1. Visit your Netlify URL — you should see the login page.
2. Log in with the seeded credentials (`admin` / your `INITIAL_USER_PASSWORD`).
3. Visit `https://wonder-bites-api.onrender.com/healthz` — should return `{"status":"ok"}`.
4. Visit `https://wonder-bites-api.onrender.com/readyz` — should return `{"status":"ready","database":"connected"}`.
5. The MCP endpoint is available at `https://wonder-bites-api.onrender.com/mcp`.

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `DIRECT_URL` | No | `DATABASE_URL` | Direct DB URL for Prisma migrations |
| `NODE_ENV` | No | `development` | `development` or `production` |
| `PORT` | No | `3001` | Server listen port |
| `SESSION_SECRET` | Yes | — | Session cookie signing secret |
| `MCP_BEARER_TOKEN` | Yes | — | Bearer token for MCP authentication |
| `INITIAL_USERNAME` | No | `admin` | Seed user username |
| `INITIAL_USER_PASSWORD` | No | `changeme123` | Seed user password |
| `FRONTEND_ORIGIN` | No | `http://localhost:5173` | CORS allowed origin |
| `API_PUBLIC_URL` | No | `http://localhost:3001` | Public API base URL |
| `LOG_LEVEL` | No | `info` | Pino log level |
| `RATE_LIMIT_MAX` | No | `100` | Max requests per window |
| `RATE_LIMIT_WINDOW_MS` | No | `60000` | Rate limit window in ms |

---

## Troubleshooting

| Issue | Solution |
|---|---|
| Build fails on `prisma generate` | Ensure `@prisma/client` is in dependencies and `prisma` in devDependencies |
| `/readyz` returns 503 | Check `DATABASE_URL` is set and the PostgreSQL instance is running |
| CORS errors from frontend | Verify `FRONTEND_ORIGIN` matches your Netlify URL exactly |
| 401 on MCP calls | Verify `MCP_BEARER_TOKEN` is set and the client sends `Authorization: Bearer <token>` |
| Seed user not created | Check `INITIAL_USERNAME`/`INITIAL_USER_PASSWORD` env vars; run `pnpm db:seed` manually |
