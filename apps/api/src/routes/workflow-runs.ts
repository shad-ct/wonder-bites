import type { FastifyPluginAsync } from 'fastify';
import { WorkflowRunQuerySchema } from '@wonder-bites/shared';
import { listWorkflowRuns, getWorkflowRun } from '../services/workflow-run.service.js';

export const workflowRunRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /workflow-runs
   * Paginated list of workflow runs with filters.
   */
  fastify.get('/', async (request, reply) => {
    const parseResult = WorkflowRunQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid query parameters',
        code: 'VALIDATION_ERROR',
        details: parseResult.error.format(),
      });
    }

    const runs = await listWorkflowRuns(parseResult.data);
    return runs;
  });

  /**
   * GET /workflow-runs/:id
   * Fetch single workflow run details by ID.
   */
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const run = await getWorkflowRun(id);

    if (!run) {
      return reply.status(404).send({
        success: false,
        error: `Workflow run "${id}" not found`,
        code: 'NOT_FOUND',
      });
    }

    return {
      success: true,
      data: run,
    };
  });
};
