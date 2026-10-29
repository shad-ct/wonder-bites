import type { FastifyPluginAsync } from 'fastify';
import {
  ReadingListAddSchema,
  ReadingListUpdateSchema,
  PaginationQuerySchema,
  ReadingStatusSchema,
} from '@wonder-bites/shared';
import {
  getReadingList,
  saveToReadingList,
  updateReadingItem,
  removeFromReadingList,
} from '../services/reading-list.service.js';
import { requireAuth } from '../middleware/auth.js';

export const readingListRoutes: FastifyPluginAsync = async (fastify) => {
  // All reading list endpoints require authentication
  fastify.addHook('preHandler', requireAuth);

  /**
   * GET /reading-list
   * Paginated list of user's saved items with optional status filtering.
   */
  fastify.get('/', async (request, reply) => {
    const rawQuery = request.query as Record<string, unknown>;
    const paginationResult = PaginationQuerySchema.safeParse(rawQuery);

    if (!paginationResult.success) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid pagination parameters',
        code: 'VALIDATION_ERROR',
      });
    }

    let status;
    if (rawQuery.status) {
      const statusResult = ReadingStatusSchema.safeParse(rawQuery.status);
      if (!statusResult.success) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid reading status filter',
          code: 'VALIDATION_ERROR',
        });
      }
      status = statusResult.data;
    }

    const userId = request.user!.id;
    const { page, pageSize } = paginationResult.data;

    const result = await getReadingList(userId, status, page, pageSize);
    return result;
  });

  /**
   * POST /reading-list
   * Add a content entry to the user's reading list (idempotent).
   */
  fastify.post('/', async (request, reply) => {
    const parseResult = ReadingListAddSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: parseResult.error.format(),
      });
    }

    try {
      const item = await saveToReadingList(request.user!.id, parseResult.data.contentEntryId);
      return reply.status(201).send({
        success: true,
        data: item,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save to reading list';
      return reply.status(404).send({
        success: false,
        error: message,
        code: 'NOT_FOUND',
      });
    }
  });

  /**
   * PATCH /reading-list/:id
   * Update status ('saved' | 'reading' | 'completed') and/or personal notes.
   */
  fastify.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parseResult = ReadingListUpdateSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: parseResult.error.format(),
      });
    }

    try {
      const updated = await updateReadingItem(
        request.user!.id,
        { id },
        parseResult.data
      );

      return {
        success: true,
        data: updated,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Item not found';
      return reply.status(404).send({
        success: false,
        error: message,
        code: 'NOT_FOUND',
      });
    }
  });

  /**
   * DELETE /reading-list/:id
   * Remove item from reading list without deleting the underlying content entry.
   */
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = await removeFromReadingList(request.user!.id, id);

    if (!deleted) {
      return reply.status(404).send({
        success: false,
        error: 'Reading list item not found',
        code: 'NOT_FOUND',
      });
    }

    return {
      success: true,
      data: { message: 'Removed from reading list' },
    };
  });
};
