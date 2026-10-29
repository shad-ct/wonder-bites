import type { FastifyLoggerOptions } from 'fastify';
import type { PinoLoggerOptions } from 'fastify/types/logger.js';

/**
 * Sensitive fields to redact from logs for privacy and security.
 */
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["set-cookie"]',
  'password',
  'passwordHash',
  'token',
  'secret',
  'session_token',
  '*.password',
  '*.passwordHash',
  '*.token',
  '*.secret',
  '*.session_token',
  '*.authorization',
  '*.cookie',
];

/**
 * Pino logger configuration for Fastify.
 */
export const loggerConfig: FastifyLoggerOptions & PinoLoggerOptions = {
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
  redact: {
    paths: REDACT_PATHS,
    censor: '[REDACTED]',
  },
  serializers: {
    req(request: any) {
      return {
        method: request.method,
        url: request.url,
        path: request.routerPath || request.url,
        parameters: request.params,
        headers: request.headers,
      };
    },
    res(reply: any) {
      return {
        statusCode: reply.statusCode,
      };
    },
  },
};
