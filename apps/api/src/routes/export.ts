import type { FastifyPluginAsync } from 'fastify';
import { ExportFormatSchema } from '@wonder-bites/shared';
import {
  exportEntryMarkdown,
  exportWorkflowHistory,
  exportFullLibrary,
  exportReadingList,
} from '../services/export.service.js';
import { requireAuth } from '../middleware/auth.js';

export const exportRoutes: FastifyPluginAsync = async (fastify) => {
  // All export routes require authentication
  fastify.addHook('preHandler', requireAuth);

  /**
   * GET /export/entry/:id
   * Export single content entry as markdown with YAML frontmatter.
   */
  fastify.get('/entry/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const exported = await exportEntryMarkdown(id);

    if (!exported) {
      return reply.status(404).send({
        success: false,
        error: `Content entry "${id}" not found`,
        code: 'NOT_FOUND',
      });
    }

    reply.header('Content-Type', 'text/markdown; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="${exported.filename}"`);
    return reply.send(exported.content);
  });

  /**
   * GET /export/workflow/:slug
   * Export workflow history as Markdown or JSON.
   */
  fastify.get('/workflow/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const query = request.query as { format?: string };

    let format: 'markdown' | 'json' = 'json';
    if (query.format) {
      const parsedFormat = ExportFormatSchema.safeParse(query.format);
      if (parsedFormat.success) {
        format = parsedFormat.data;
      }
    }

    const exported = await exportWorkflowHistory(slug, format);
    if (!exported) {
      return reply.status(404).send({
        success: false,
        error: `Workflow "${slug}" not found`,
        code: 'NOT_FOUND',
      });
    }

    reply.header('Content-Type', exported.contentType);
    reply.header('Content-Disposition', `attachment; filename="${exported.filename}"`);
    return reply.send(exported.content);
  });

  /**
   * GET /export/library
   * Export entire knowledge base as JSON.
   */
  fastify.get('/library', async (request, reply) => {
    const exported = await exportFullLibrary();

    reply.header('Content-Type', 'application/json; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="${exported.filename}"`);
    return reply.send(exported.content);
  });

  /**
   * GET /export/reading-list
   * Export reading list with completion state and personal notes.
   */
  fastify.get('/reading-list', async (request, reply) => {
    const exported = await exportReadingList(request.user!.id);

    reply.header('Content-Type', 'application/json; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="${exported.filename}"`);
    return reply.send(exported.content);
  });
};
