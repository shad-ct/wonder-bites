import type { FastifyPluginAsync } from 'fastify';
import type { Prisma } from '@prisma/client';
import { UserSettingsSchema } from '@wonder-bites/shared';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

export const settingsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', requireAuth);

  /**
   * GET /settings
   * Retrieve current user settings and preferences.
   */
  fastify.get('/', async (request) => {
    const user = request.user!;
    return {
      success: true,
      data: {
        id: user.id,
        username: user.username,
        timezone: user.timezone,
        preferences: (user.preferences as Record<string, unknown>) || {},
      },
    };
  });

  /**
   * PUT /settings
   * Update timezone and/or preferences.
   */
  fastify.put('/', async (request, reply) => {
    const parseResult = UserSettingsSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: parseResult.error.format(),
      });
    }

    const { timezone, preferences } = parseResult.data;
    const updateData: Prisma.UserUpdateInput = {};

    if (timezone) updateData.timezone = timezone;
    if (preferences !== undefined) {
      const currentPreferences = (request.user!.preferences as Record<string, unknown>) || {};
      updateData.preferences = {
        ...currentPreferences,
        ...preferences,
      } as Prisma.InputJsonValue;
    }

    const updated = await prisma.user.update({
      where: { id: request.user!.id },
      data: updateData,
    });

    request.user = updated;

    return {
      success: true,
      data: {
        id: updated.id,
        username: updated.username,
        timezone: updated.timezone,
        preferences: updated.preferences,
      },
    };
  });
};
