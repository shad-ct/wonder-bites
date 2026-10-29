import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/index.js';

describe('MCP Authentication Middleware', () => {
  let server: FastifyInstance;
  const validToken = 'test-mcp-bearer-secret-token-123';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.MCP_BEARER_TOKEN = validToken;
    server = await buildServer();
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  it('rejects requests without Authorization header with 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/mcp',
      payload: { jsonrpc: '2.0', method: 'initialize', id: 1 },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.code).toBe('UNAUTHORIZED');
  });

  it('rejects requests with invalid Bearer token with 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        authorization: 'Bearer wrong-invalid-token',
      },
      payload: { jsonrpc: '2.0', method: 'initialize', id: 1 },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.code).toBe('UNAUTHORIZED');
  });

  it('accepts requests with valid Bearer token', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        authorization: `Bearer ${validToken}`,
        accept: 'application/json, text/event-stream',
      },
      payload: {
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0' },
        },
        id: 1,
      },
    });

    // Valid token passes auth middleware (status 200)
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.jsonrpc).toBe('2.0');
    expect(body.result.serverInfo.name).toBe('wonder-bites-hub');
  });
});
