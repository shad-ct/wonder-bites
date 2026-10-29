import { describe, it, expect } from 'vitest';
import { createMcpServer } from '../src/mcp/server.js';

describe('MCP Server Tools Registration', () => {
  it('registers all 16 required tools', () => {
    const server = createMcpServer();
    const registeredTools = (server as any)._registeredTools;

    const expectedTools = [
      'list_workflows',
      'get_workflow',
      'search_content_history',
      'get_content_entry',
      'get_recent_entries',
      'get_reading_list',
      'get_next_workflow_context',
      'get_workflow_run_status',
      'get_dashboard_summary',
      'publish_content_entry',
      'update_content_entry',
      'save_to_reading_list',
      'update_reading_status',
      'add_personal_note',
      'start_workflow_run',
      'complete_workflow_run',
    ];

    for (const toolName of expectedTools) {
      expect(registeredTools).toHaveProperty(toolName);
      expect(registeredTools[toolName].description).toBeDefined();
    }

    expect(Object.keys(registeredTools).length).toBe(16);
  });
});
