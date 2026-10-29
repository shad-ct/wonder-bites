import crypto from 'node:crypto';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  McpListWorkflowsInputSchema,
  McpGetWorkflowInputSchema,
  McpSearchContentInputSchema,
  McpGetContentEntryInputSchema,
  McpGetRecentEntriesInputSchema,
  McpGetReadingListInputSchema,
  McpGetNextWorkflowContextInputSchema,
  McpGetWorkflowRunStatusInputSchema,
  McpGetDashboardSummaryInputSchema,
  McpPublishContentInputSchema,
  McpUpdateContentInputSchema,
  McpSaveToReadingListInputSchema,
  McpUpdateReadingStatusInputSchema,
  McpAddPersonalNoteInputSchema,
  McpStartWorkflowRunInputSchema,
  McpCompleteWorkflowRunInputSchema,
  type WorkflowSlug,
} from '@wonder-bites/shared';

import { requireMcpAuth } from '../middleware/mcp-auth.js';
import { listWorkflows, getWorkflow } from '../services/workflow.service.js';
import {
  listContentEntries,
  getContentEntry,
  getRecentEntries,
  publishContentEntry,
  updateContentEntry,
} from '../services/content.service.js';
import {
  getReadingList,
  saveToReadingList,
  updateReadingItem,
} from '../services/reading-list.service.js';
import { getNextWorkflowContext } from '../services/context.service.js';
import {
  startWorkflowRun,
  completeWorkflowRun,
  getWorkflowRun,
} from '../services/workflow-run.service.js';
import { getDashboardSummary } from '../services/dashboard.service.js';
import { getDefaultUserId } from '../services/user.service.js';

/**
 * Creates and registers all 16 tools on an McpServer instance.
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'wonder-bites-hub',
    version: '0.1.0',
  });

  // 1. list_workflows
  server.tool(
    'list_workflows',
    'List all 7 automated learning hub workflows with execution counts and last run status',
    McpListWorkflowsInputSchema.shape,
    async () => {
      try {
        const workflows = await listWorkflows();
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, data: workflows }) }],
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Failed to list workflows';
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error }) }],
          isError: true,
        };
      }
    }
  );

  // 2. get_workflow
  server.tool(
    'get_workflow',
    'Get detailed statistics, configuration, and schedule for a specific workflow',
    McpGetWorkflowInputSchema.shape,
    async ({ slug }) => {
      try {
        const workflow = await getWorkflow(slug);
        if (!workflow) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ success: false, error: `Workflow "${slug}" not found` }) }],
            isError: true,
          };
        }
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, data: workflow }) }],
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Failed to get workflow';
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error }) }],
          isError: true,
        };
      }
    }
  );

  // 3. search_content_history
  server.tool(
    'search_content_history',
    'Search content entries with full-text search, workflow slug, tag, and date range filters',
    McpSearchContentInputSchema.shape,
    async (params) => {
      try {
        const results = await listContentEntries(params);
        return {
          content: [{ type: 'text', text: JSON.stringify(results) }],
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Search failed';
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error }) }],
          isError: true,
        };
      }
    }
  );

  // 4. get_content_entry
  server.tool(
    'get_content_entry',
    'Get a specific content entry by UUID with complete content markdown and metadata',
    McpGetContentEntryInputSchema.shape,
    async ({ id }) => {
      try {
        const entry = await getContentEntry(id);
        if (!entry) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ success: false, error: `Entry "${id}" not found` }) }],
            isError: true,
          };
        }
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, data: entry }) }],
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Failed to get content entry';
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error }) }],
          isError: true,
        };
      }
    }
  );

  // 5. get_recent_entries
  server.tool(
    'get_recent_entries',
    'Retrieve recent content entries published across workflows within a given lookback window',
    McpGetRecentEntriesInputSchema.shape,
    async ({ workflowSlugs, lookbackDays, limit }) => {
      try {
        const entries = await getRecentEntries(workflowSlugs, lookbackDays, limit);
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, data: entries }) }],
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Failed to get recent entries';
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error }) }],
          isError: true,
        };
      }
    }
  );

  // 6. get_reading_list
  server.tool(
    'get_reading_list',
    'Fetch items currently saved or completed in the reading list',
    McpGetReadingListInputSchema.shape,
    async ({ status, page, pageSize }) => {
      try {
        const userId = await getDefaultUserId();
        const list = await getReadingList(userId, status, page, pageSize);
        return {
          content: [{ type: 'text', text: JSON.stringify(list) }],
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Failed to get reading list';
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error }) }],
          isError: true,
        };
      }
    }
  );

  // 7. get_next_workflow_context
  server.tool(
    'get_next_workflow_context',
    'Fetch rotation state, syllabus progress, recent patterns, and topics to guide the next workflow run',
    McpGetNextWorkflowContextInputSchema.shape,
    async ({ workflowSlug }) => {
      try {
        const context = await getNextWorkflowContext(workflowSlug as WorkflowSlug);
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, data: context }) }],
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Failed to get workflow context';
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error }) }],
          isError: true,
        };
      }
    }
  );

  // 8. get_workflow_run_status
  server.tool(
    'get_workflow_run_status',
    'Check the current status and results of a workflow run execution by ID',
    McpGetWorkflowRunStatusInputSchema.shape,
    async ({ runId }) => {
      try {
        const run = await getWorkflowRun(runId);
        if (!run) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ success: false, error: `Run "${runId}" not found` }) }],
            isError: true,
          };
        }
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, data: run }) }],
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Failed to get run status';
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error }) }],
          isError: true,
        };
      }
    }
  );

  // 9. get_dashboard_summary
  server.tool(
    'get_dashboard_summary',
    'Get comprehensive learning hub dashboard metrics including reading counts and recent runs',
    McpGetDashboardSummaryInputSchema.shape,
    async () => {
      try {
        const summary = await getDashboardSummary();
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, data: summary }) }],
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Failed to get dashboard summary';
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error }) }],
          isError: true,
        };
      }
    }
  );

  // 10. publish_content_entry
  server.tool(
    'publish_content_entry',
    'Publish a new content entry with idempotency protection and audit tracking',
    McpPublishContentInputSchema.shape,
    async (params) => {
      try {
        const entry = await publishContentEntry(params, 'mcp');
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                data: {
                  id: entry.id,
                  slug: entry.slug,
                  title: entry.title,
                  workflowSlug: entry.workflow?.slug,
                },
              }),
            },
          ],
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Publish failed';
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error }) }],
          isError: true,
        };
      }
    }
  );

  // 11. update_content_entry
  server.tool(
    'update_content_entry',
    'Update existing content entry markdown and metadata, snapshotting a ContentRevision',
    McpUpdateContentInputSchema.shape,
    async ({ id, ...updateData }) => {
      try {
        const updated = await updateContentEntry(
          id,
          { ...updateData, changeSource: 'mcp' },
          'mcp'
        );
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, data: updated }) }],
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Update failed';
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error }) }],
          isError: true,
        };
      }
    }
  );

  // 12. save_to_reading_list
  server.tool(
    'save_to_reading_list',
    'Save an existing content entry to the default user reading list',
    McpSaveToReadingListInputSchema.shape,
    async ({ contentEntryId }) => {
      try {
        const userId = await getDefaultUserId();
        const item = await saveToReadingList(userId, contentEntryId);
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, data: item }) }],
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Failed to save to reading list';
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error }) }],
          isError: true,
        };
      }
    }
  );

  // 13. update_reading_status
  server.tool(
    'update_reading_status',
    'Update reading status (saved, reading, completed) for a content entry',
    McpUpdateReadingStatusInputSchema.shape,
    async ({ contentEntryId, status }) => {
      try {
        const userId = await getDefaultUserId();
        const item = await updateReadingItem(userId, { contentEntryId }, { status });
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, data: item }) }],
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Failed to update reading status';
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error }) }],
          isError: true,
        };
      }
    }
  );

  // 14. add_personal_note
  server.tool(
    'add_personal_note',
    'Add or update personal notes and reflections on a content entry',
    McpAddPersonalNoteInputSchema.shape,
    async ({ contentEntryId, note }) => {
      try {
        const userId = await getDefaultUserId();
        const item = await updateReadingItem(userId, { contentEntryId }, { personalNote: note });
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, data: item }) }],
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Failed to add note';
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error }) }],
          isError: true,
        };
      }
    }
  );

  // 15. start_workflow_run
  server.tool(
    'start_workflow_run',
    'Record the start of a workflow run execution (idempotent)',
    McpStartWorkflowRunInputSchema.shape,
    async (params) => {
      try {
        const run = await startWorkflowRun(params);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                data: {
                  runId: run.id,
                  status: run.status,
                  idempotencyKey: run.idempotencyKey,
                },
              }),
            },
          ],
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Failed to start workflow run';
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error }) }],
          isError: true,
        };
      }
    }
  );

  // 16. complete_workflow_run
  server.tool(
    'complete_workflow_run',
    'Mark a workflow run as completed or failed with final metrics and audit record',
    McpCompleteWorkflowRunInputSchema.shape,
    async (params) => {
      try {
        const run = await completeWorkflowRun(params);
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, data: run }) }],
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Failed to complete workflow run';
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error }) }],
          isError: true,
        };
      }
    }
  );

  return server;
}

/**
 * Session storage for stateful Streamable HTTP connections.
 */
interface McpSessionState {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
}

const activeSessions = new Map<string, McpSessionState>();

/**
 * Fastify plugin mounting the Streamable HTTP MCP server on /mcp.
 */
export const mcpPlugin: FastifyPluginAsync = async (fastify) => {
  // Apply MCP Bearer token authentication to all /mcp routes
  fastify.addHook('preHandler', requireMcpAuth);

  /**
   * POST /mcp
   * Handles JSON-RPC requests from MCP clients.
   */
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    reply.hijack();

    const sessionId = request.headers['mcp-session-id'] as string | undefined;

    // Stateful request with existing session
    if (sessionId) {
      const session = activeSessions.get(sessionId);
      if (!session) {
        reply.raw.writeHead(404, { 'Content-Type': 'application/json' });
        reply.raw.end(
          JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32001, message: 'Session not found' },
            id: null,
          })
        );
        return;
      }

      await session.transport.handleRequest(request.raw, reply.raw, request.body);
      return;
    }

    // Inspect if this is an initialization request
    const body = request.body as { method?: string } | undefined;
    const isInitialize = body?.method === 'initialize';

    if (isInitialize) {
      const server = createMcpServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
        onsessioninitialized: (id) => {
          activeSessions.set(id, { server, transport });
        },
        onsessionclosed: (id) => {
          activeSessions.delete(id);
        },
        enableJsonResponse: true,
      });

      await server.connect(transport);
      await transport.handleRequest(request.raw, reply.raw, request.body);
      return;
    }

    // Stateless mode (direct request without session handshake)
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    await server.connect(transport);
    await transport.handleRequest(request.raw, reply.raw, request.body);
  });

  /**
   * GET /mcp
   * Handles SSE streams for server-to-client notifications.
   */
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    reply.hijack();

    const sessionId = request.headers['mcp-session-id'] as string | undefined;

    if (sessionId) {
      const session = activeSessions.get(sessionId);
      if (!session) {
        reply.raw.writeHead(404, { 'Content-Type': 'application/json' });
        reply.raw.end(
          JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32001, message: 'Session not found' },
            id: null,
          })
        );
        return;
      }

      await session.transport.handleRequest(request.raw, reply.raw);
      return;
    }

    // Create a new stateful session for SSE
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      onsessioninitialized: (id) => {
        activeSessions.set(id, { server, transport });
      },
      onsessionclosed: (id) => {
        activeSessions.delete(id);
      },
      enableJsonResponse: false,
    });

    await server.connect(transport);
    await transport.handleRequest(request.raw, reply.raw);
  });

  /**
   * DELETE /mcp
   * Handles session termination.
   */
  fastify.delete('/', async (request: FastifyRequest, reply: FastifyReply) => {
    reply.hijack();

    const sessionId = request.headers['mcp-session-id'] as string | undefined;
    if (!sessionId) {
      reply.raw.writeHead(400, { 'Content-Type': 'application/json' });
      reply.raw.end(
        JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32600, message: 'Missing mcp-session-id header' },
          id: null,
        })
      );
      return;
    }

    const session = activeSessions.get(sessionId);
    if (!session) {
      reply.raw.writeHead(404, { 'Content-Type': 'application/json' });
      reply.raw.end(
        JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32001, message: 'Session not found' },
          id: null,
        })
      );
      return;
    }

    await session.transport.handleRequest(request.raw, reply.raw);
    activeSessions.delete(sessionId);
  });
};
