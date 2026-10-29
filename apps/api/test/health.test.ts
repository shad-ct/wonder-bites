import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/index.js';

describe('Health Endpoints', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    server = await buildServer();
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  it('GET /healthz returns 200 with status ok', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/healthz',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toEqual({ status: 'ok' });
  });

  it('handles unknown routes with 404', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/unknown-route-12345',
    });

    expect(res.statusCode).toBe(404);
  });
});
