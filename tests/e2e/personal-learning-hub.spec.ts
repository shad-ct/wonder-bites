// tests/e2e/personal-learning-hub.spec.ts
// Critical path E2E test for Personal Learning Hub
// Requires running API + frontend (see README for local dev setup)

import { test, expect } from '@playwright/test';

test.describe('Personal Learning Hub — Critical Path', () => {
  const API_URL = process.env.API_URL || 'http://localhost:3001';
  const WEB_URL = process.env.WEB_URL || 'http://localhost:5173';

  test.beforeEach(async ({ page }) => {
    // Seed a content entry via MCP before each test
    await page.request.post(`${API_URL}/mcp`, {
      headers: {
        Authorization: `Bearer ${process.env.MCP_BEARER_TOKEN}`,
        'Content-Type': 'application/json',
      },
      data: {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'publish_content_entry',
          arguments: {
            workflowSlug: 'science-signal',
            title: 'E2E Test Entry',
            summary: 'An entry created by the E2E test suite.',
            contentMarkdown: '# E2E Test Entry\n\nThis entry was created by the critical path E2E test.',
            category: 'Physics',
            tags: ['test', 'e2e'],
            sourceUrls: [],
            idempotencyKey: `e2e-test-${Date.now()}`,
          },
        },
      },
    });
  });

  test('should load dashboard and show published entry', async ({ page }) => {
    await page.goto(WEB_URL);

    // Login
    await page.fill('input[placeholder="Enter your username"]', 'admin');
    await page.fill('input[placeholder="Enter your password"]', process.env.INITIAL_USER_PASSWORD || 'changeme123');
    await page.click('button:has-text("Sign In")');

    // Should redirect to dashboard
    await expect(page).toHaveURL(`${WEB_URL}/`);
    await expect(page.locator('h1')).toContainText('Good');
  });

  test('should save entry to reading list and mark completed', async ({ page }) => {
    await page.goto(`${WEB_URL}/library`);

    // Find the test entry
    await expect(page.locator('text=E2E Test Entry')).toBeVisible();

    // Click entry to open detail
    await page.click('text=E2E Test Entry');

    // Save to reading list
    await page.click('button:has-text("Save")');

    // Mark as completed
    await page.click('button:has-text("Mark as Read")');

    // Navigate to reading list
    await page.click('a:has-text("Read Later")');

    // Verify entry appears as completed
    await expect(page.locator('text=E2E Test Entry')).toBeVisible();
    await expect(page.locator('text=Completed')).toBeVisible();
  });
});
