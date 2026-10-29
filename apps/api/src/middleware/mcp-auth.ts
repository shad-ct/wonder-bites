import crypto from 'node:crypto';
import type { FastifyRequest, FastifyReply, preHandlerHookHandler } from 'fastify';

/**
 * PreHandler middleware that validates the Bearer token in the Authorization header.
 * Uses timingSafeEqual for constant-time comparison against MCP_BEARER_TOKEN.
 */
export const requireMcpAuth: preHandlerHookHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({
      success: false,
      error: 'Missing or malformed Authorization header. Expected "Bearer <token>"',
      code: 'UNAUTHORIZED',
    });
  }

  const token = authHeader.slice(7).trim();
  const expectedToken = process.env.MCP_BEARER_TOKEN || '';

  if (!expectedToken) {
    request.log.error('MCP_BEARER_TOKEN environment variable is not configured');
    return reply.status(401).send({
      success: false,
      error: 'MCP authorization is not configured on server',
      code: 'UNAUTHORIZED',
    });
  }

  const tokenBuffer = Buffer.from(token);
  const expectedBuffer = Buffer.from(expectedToken);

  if (
    tokenBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(tokenBuffer, expectedBuffer)
  ) {
    return reply.status(401).send({
      success: false,
      error: 'Invalid MCP Bearer token',
      code: 'UNAUTHORIZED',
    });
  }
};
