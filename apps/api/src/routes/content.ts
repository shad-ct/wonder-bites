import type { FastifyPluginAsync } from 'fastify';
import {
  ContentEntryCreateSchema,
  ContentEntryUpdateSchema,
  ContentSearchSchema,
  PaginationQuerySchema,
} from '@wonder-bites/shared';
import {
  listContentEntries,
  searchContent,
  getContentEntry,
  getContentEntryBySlug,
  updateContentEntry,
  getContentRevisions,
  publishContentEntry,
  deleteContentEntry,
} from '../services/content.service.js';
import { requireAuth } from '../middleware/auth.js';

export const contentRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /content
   * Paginated list of content entries with filters.
   */
  fastify.get('/', async (request, reply) => {
    const rawQuery = request.query as Record<string, unknown>;

    // Normalize tags if supplied as comma-separated string
    let tags: string[] | undefined;
    if (typeof rawQuery.tags === 'string') {
      tags = rawQuery.tags.split(',').map((t) => t.trim()).filter(Boolean);
    } else if (Array.isArray(rawQuery.tags)) {
      tags = rawQuery.tags as string[];
    }

    const parseResult = ContentSearchSchema.safeParse({
      ...rawQuery,
      tags,
    });

    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid query parameters',
        code: 'VALIDATION_ERROR',
        details: parseResult.error.format(),
      });
    }

    const userId = request.user?.id;
    const result = await listContentEntries(parseResult.data, userId);
    return result;
  });

  /**
   * GET /content/search
   * Search content entries across title, summary, and markdown.
   */
  fastify.get('/search', async (request, reply) => {
    const rawQuery = request.query as Record<string, unknown>;
    const parseResult = PaginationQuerySchema.safeParse(rawQuery);

    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid pagination parameters',
        code: 'VALIDATION_ERROR',
      });
    }

    const query = typeof rawQuery.query === 'string' ? rawQuery.query : undefined;
    const userId = request.user?.id;
    const result = await searchContent(query, parseResult.data.page, parseResult.data.pageSize, userId);
    return result;
  });

  /**
   * POST /content
   * Create a new content entry via REST.
   */
  fastify.post('/', { preHandler: requireAuth }, async (request, reply) => {
    const parseResult = ContentEntryCreateSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: parseResult.error.format(),
      });
    }

    try {
      const entry = await publishContentEntry(parseResult.data, 'user');
      return reply.status(201).send({
        success: true,
        data: entry,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to publish entry';
      return reply.status(400).send({
        success: false,
        error: message,
        code: 'PUBLISH_FAILED',
      });
    }
  });

  /**
   * GET /content/:id/revisions
   * Fetch revision history for a content entry.
   */
  fastify.get('/:id/revisions', async (request, reply) => {
    const { id } = request.params as { id: string };
    const revisions = await getContentRevisions(id);
    return {
      success: true,
      data: revisions,
    };
  });

  /**
   * GET /content/:id
   * Fetch single content entry by ID (or slug).
   */
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user?.id;

    // Try finding by UUID first, fallback to slug
    let entry = await getContentEntry(id, userId);
    if (!entry) {
      entry = await getContentEntryBySlug(id, userId);
    }

    if (!entry) {
      return reply.status(404).send({
        success: false,
        error: `Content entry "${id}" not found`,
        code: 'NOT_FOUND',
      });
    }

    return {
      success: true,
      data: entry,
    };
  });

  /**
   * PUT /content/:id
   * Update content entry, automatically snapshotting previous version into ContentRevision.
   */
  fastify.put('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const parseResult = ContentEntryUpdateSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: parseResult.error.format(),
      });
    }

    try {
      const updated = await updateContentEntry(id, parseResult.data, 'user');
      return {
        success: true,
        data: updated,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Update failed';
      return reply.status(404).send({
        success: false,
        error: message,
        code: 'NOT_FOUND',
      });
    }
  });

  /**
   * DELETE /content/:id
   * Delete a content entry (article) and its related records.
   */
  fastify.delete('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = await deleteContentEntry(id, request.user!.id);

    if (!deleted) {
      return reply.status(404).send({
        success: false,
        error: `Content entry "${id}" not found`,
        code: 'NOT_FOUND',
      });
    }

    return {
      success: true,
      data: { message: 'Article deleted' },
    };
  });
};
