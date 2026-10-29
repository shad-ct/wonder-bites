import fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';

import { loggerConfig } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { authPlugin } from './middleware/auth.js';
import { apiRoutes } from './routes/index.js';
import { mcpPlugin } from './mcp/server.js';
import { ensureWorkflowsExist } from './services/workflow.service.js';

const PORT = Number(process.env.PORT) || 3001;
const HOST = '0.0.0.0';
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const SESSION_SECRET = process.env.SESSION_SECRET || 'wonder-bites-hub-session-secret-at-least-32-chars';

/**
 * Builds and configures the Fastify server instance.
 */
export async function buildServer() {
  const server = fastify({
    logger: loggerConfig,
    bodyLimit: 5 * 1024 * 1024, // 5MB limit
  });

  // 1. Security headers
  await server.register(helmet, {
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  // 2. CORS configuration
  await server.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (like mobile apps, curl, MCP clients)
      if (!origin) {
        cb(null, true);
        return;
      }
      if (origin === FRONTEND_ORIGIN || origin.startsWith('http://localhost:')) {
        cb(null, true);
        return;
      }
      cb(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
  });

  // 3. Cookie support
  await server.register(cookie, {
    secret: SESSION_SECRET,
  });

  // 4. Rate limiting
  await server.register(rateLimit, {
    max: Number(process.env.RATE_LIMIT_MAX) || 100,
    timeWindow: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
    allowList: ['127.0.0.1', 'localhost'],
  });

  // 5. Session authentication middleware
  await server.register(authPlugin);

  // 6. Health check routes
  server.get('/healthz', async () => {
    return { status: 'ok' };
  });

  server.get('/readyz', async (request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'ready', database: 'connected' };
    } catch (err) {
      server.log.error({ err }, 'Readiness check failed');
      return reply.status(503).send({
        status: 'error',
        database: 'disconnected',
        error: err instanceof Error ? err.message : 'Database check failed',
      });
    }
  });

  // 7. MCP Streamable HTTP routes (/mcp)
  await server.register(mcpPlugin, { prefix: '/mcp' });

  // 8. REST API routes (/api/v1)
  await server.register(apiRoutes, { prefix: '/api/v1' });

  // 9. Consistent error handling
  server.setErrorHandler((error: any, request, reply) => {
    const statusCode = error.statusCode || 500;
    const errorCode = error.code || 'INTERNAL_SERVER_ERROR';

    if (statusCode >= 500) {
      server.log.error({ err: error, req: request.url }, 'Unhandled server error');
    }

    reply.status(statusCode).send({
      success: false,
      error: error.message || 'An unexpected error occurred',
      code: errorCode,
    });
  });

  return server;
}

/**
 * Start the Fastify server and attach process signal handlers.
 */
async function start() {
  const server = await buildServer();

  // Ensure default workflows exist in DB
  try {
    await ensureWorkflowsExist();
  } catch (err) {
    server.log.warn({ err }, 'Could not initialize default workflows at startup');
  }

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    server.log.info(`Received ${signal}. Shutting down gracefully...`);
    try {
      await server.close();
      await prisma.$disconnect();
      server.log.info('Server and database connections closed cleanly');
      process.exit(0);
    } catch (err) {
      server.log.error({ err }, 'Error during graceful shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  try {
    await server.listen({ port: PORT, host: HOST });
    server.log.info(`🚀 Personal Learning Hub API listening on http://${HOST}:${PORT}`);
    server.log.info(`📡 MCP Endpoint active at http://${HOST}:${PORT}/mcp`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

// Automatically start when executed directly
if (process.env.NODE_ENV !== 'test') {
  start();
}
