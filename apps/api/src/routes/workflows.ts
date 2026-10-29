import type { FastifyPluginAsync } from 'fastify';
import { WorkflowUpdateSchema, WorkflowSlugSchema } from '@wonder-bites/shared';
import {
  listWorkflows,
  getWorkflow,
  updateWorkflow,
  triggerWorkflow,
} from '../services/workflow.service.js';
import { requireAuth } from '../middleware/auth.js';

export const workflowRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /workflows
   * List all workflows with execution counts and last run summary.
   */
  fastify.get('/', async () => {
    const workflows = await listWorkflows();
    return {
      success: true,
      data: workflows,
    };
  });

  /**
   * GET /workflows/:slug
   * Single workflow detailed information and statistics.
   */
  fastify.get('/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const workflow = await getWorkflow(slug);

    if (!workflow) {
      return reply.status(404).send({
        success: false,
        error: `Workflow "${slug}" not found`,
        code: 'NOT_FOUND',
      });
    }

    return {
      success: true,
      data: workflow,
    };
  });

  /**
   * PATCH /workflows/:slug
   * Update workflow schedule, enabled status, timezone, or configuration.
   */
  fastify.patch('/:slug', { preHandler: requireAuth }, async (request, reply) => {
    const { slug } = request.params as { slug: string };

    const parseResult = WorkflowUpdateSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: parseResult.error.format(),
      });
    }

    const updated = await updateWorkflow(slug, parseResult.data);
    if (!updated) {
      return reply.status(404).send({
        success: false,
        error: `Workflow "${slug}" not found`,
        code: 'NOT_FOUND',
      });
    }

    return {
      success: true,
      data: updated,
    };
  });

  /**
   * POST /workflows/:slug/trigger
   * Manually trigger a workflow run in queued state.
   */
  fastify.post('/:slug/trigger', { preHandler: requireAuth }, async (request, reply) => {
    const { slug } = request.params as { slug: string };

    try {
      const run = await triggerWorkflow(slug, 'manual');
      return reply.status(202).send({
        success: true,
        data: run,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to trigger workflow';
      return reply.status(404).send({
        success: false,
        error: message,
        code: 'NOT_FOUND',
      });
    }
  });
};
