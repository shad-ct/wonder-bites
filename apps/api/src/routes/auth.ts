import type { FastifyPluginAsync } from 'fastify';
import argon2 from 'argon2';
import { LoginSchema } from '@wonder-bites/shared';
import { prisma } from '../lib/prisma.js';
import { createSession, destroySession, requireAuth, SESSION_COOKIE_NAME } from '../middleware/auth.js';

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /auth/login
   * Authenticate user with username and password, create session cookie.
   */
  fastify.post('/login', async (request, reply) => {
    const parseResult = LoginSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: parseResult.error.format(),
      });
    }

    const { username, password } = parseResult.data;

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return reply.status(401).send({
        success: false,
        error: 'Invalid username or password',
        code: 'INVALID_CREDENTIALS',
      });
    }

    const validPassword = await argon2.verify(user.passwordHash, password);
    if (!validPassword) {
      return reply.status(401).send({
        success: false,
        error: 'Invalid username or password',
        code: 'INVALID_CREDENTIALS',
      });
    }

    await createSession(reply, user.id);

    const sessionToken = request.cookies?.[SESSION_COOKIE_NAME];

    return {
      success: true,
      data: {
        id: user.id,
        username: user.username,
        timezone: user.timezone,
        preferences: user.preferences,
        token: sessionToken,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
    };
  });

  /**
   * POST /auth/logout
   * Terminate current session and clear session cookie.
   */
  fastify.post('/logout', async (request, reply) => {
    await destroySession(request, reply);
    return {
      success: true,
      data: { message: 'Logged out successfully' },
    };
  });

  /**
   * GET /auth/me
   * Return currently logged in user profile.
   */
  fastify.get('/me', { preHandler: requireAuth }, async (request) => {
    const user = request.user!;
    return {
      success: true,
      data: {
        id: user.id,
        username: user.username,
        timezone: user.timezone,
        preferences: user.preferences,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
    };
  });
};
