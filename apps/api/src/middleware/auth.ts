import crypto from 'node:crypto';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply, preHandlerHookHandler } from 'fastify';
import type { User, Session } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

// Extend Fastify types to include user and session on request
declare module 'fastify' {
  interface FastifyRequest {
    user?: User | null;
    session?: Session | null;
  }
}

export const SESSION_COOKIE_NAME = 'session_token';
export const SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60; // 7 days in seconds

/**
 * Cookie options adhering to project specifications.
 */
export const getCookieOptions = () => ({
  path: '/',
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: SESSION_DURATION_SECONDS,
});

/**
 * Creates a new session in the database and sets the session cookie on the reply.
 *
 * @param reply Fastify reply object
 * @param userId ID of the user to create session for
 * @returns The created Session record
 */
export async function createSession(reply: FastifyReply, userId: string): Promise<Session> {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000);

  const session = await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  });

  reply.setCookie(SESSION_COOKIE_NAME, token, getCookieOptions());

  return session;
}

/**
 * Destroys the current session from database and clears the session cookie.
 *
 * @param request Fastify request object
 * @param reply Fastify reply object
 */
export async function destroySession(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = request.cookies?.[SESSION_COOKIE_NAME];
  if (token) {
    try {
      await prisma.session.delete({
        where: { token },
      });
    } catch {
      // Session might already be gone
    }
  }

  reply.clearCookie(SESSION_COOKIE_NAME, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  request.user = null;
  request.session = null;
}

/**
 * Fastify plugin that verifies session cookies and attaches the user to request.
 */
export const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    request.user = null;
    request.session = null;

    const token = request.cookies?.[SESSION_COOKIE_NAME];
    if (!token) {
      return;
    }

    try {
      const session = await prisma.session.findUnique({
        where: { token },
        include: { user: true },
      });

      if (!session) {
        return;
      }

      // Check if session has expired
      if (new Date() > session.expiresAt) {
        // Clean up expired session asynchronously
        prisma.session.delete({ where: { id: session.id } }).catch(() => {});
        return;
      }

      request.session = session;
      request.user = session.user;
    } catch (err) {
      request.log.error({ err }, 'Error resolving session');
    }
  });
};

/**
 * PreHandler hook to require user authentication.
 * Returns 401 Unauthorized if no active user session is found.
 */
export const requireAuth: preHandlerHookHandler = async (request: FastifyRequest, reply: FastifyReply) => {
  if (!request.user) {
    return reply.status(401).send({
      success: false,
      error: 'Authentication required. Please log in.',
      code: 'UNAUTHORIZED',
    });
  }
};
