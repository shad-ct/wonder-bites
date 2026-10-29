import type { FastifyPluginAsync } from 'fastify';
import { getDashboardSummary } from '../services/dashboard.service.js';

export const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /dashboard/summary
   * Aggregated metrics, recent runs, upcoming workflows, and today's stats.
   */
  fastify.get('/summary', async (request) => {
    const userTimezone = request.user?.timezone || 'Asia/Kolkata';
    const userId = request.user?.id;

    const summary = await getDashboardSummary(userTimezone, userId);

    return {
      success: true,
      data: summary,
    };
  });
};
