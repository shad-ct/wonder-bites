import type { FastifyPluginAsync } from 'fastify';
import { authRoutes } from './auth.js';
import { contentRoutes } from './content.js';
import { readingListRoutes } from './reading-list.js';
import { workflowRoutes } from './workflows.js';
import { workflowRunRoutes } from './workflow-runs.js';
import { dashboardRoutes } from './dashboard.js';
import { settingsRoutes } from './settings.js';
import { exportRoutes } from './export.js';

/**
 * Register all v1 API routes under /api/v1.
 */
export const apiRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.register(authRoutes, { prefix: '/auth' });
  fastify.register(contentRoutes, { prefix: '/content' });
  fastify.register(readingListRoutes, { prefix: '/reading-list' });
  fastify.register(workflowRoutes, { prefix: '/workflows' });
  fastify.register(workflowRunRoutes, { prefix: '/workflow-runs' });
  fastify.register(dashboardRoutes, { prefix: '/dashboard' });
  fastify.register(settingsRoutes, { prefix: '/settings' });
  fastify.register(exportRoutes, { prefix: '/export' });
};
