import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from './user.service.js';
import type { DashboardSummary, ContentEntryResponse, WorkflowRunResponse, WorkflowResponse } from '@wonder-bites/shared';

/**
 * Calculates start of current day for given IANA timezone.
 */
function getStartOfDay(timeZone = 'Asia/Kolkata'): Date {
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(now);

    const year = Number(parts.find((p) => p.type === 'year')?.value);
    const month = Number(parts.find((p) => p.type === 'month')?.value) - 1;
    const day = Number(parts.find((p) => p.type === 'day')?.value);

    // Approximate UTC start of day for that timezone
    return new Date(Date.UTC(year, month, day, 0, 0, 0));
  } catch {
    const fallback = new Date();
    fallback.setHours(0, 0, 0, 0);
    return fallback;
  }
}

/**
 * Aggregates real metrics from the database for the dashboard.
 */
export async function getDashboardSummary(
  targetTimezone = 'Asia/Kolkata',
  userId?: string
): Promise<DashboardSummary> {
  const resolvedUserId = userId || (await getDefaultUserId());
  const startOfToday = getStartOfDay(targetTimezone);

  const [
    totalEntries,
    completedEntries,
    savedForLater,
    todayEntries,
    activeWorkflows,
    latestRunsRaw,
    recentContentRaw,
    upcomingWorkflowsRaw,
    failedRunsRaw,
  ] = await Promise.all([
    // 1. Total content entries
    prisma.contentEntry.count(),

    // 2. Completed entries for user
    prisma.readingListItem.count({
      where: { userId: resolvedUserId, status: 'completed' },
    }),

    // 3. Saved for later count
    prisma.readingListItem.count({
      where: { userId: resolvedUserId, status: 'saved' },
    }),

    // 4. Entries created today
    prisma.contentEntry.count({
      where: { createdAt: { gte: startOfToday } },
    }),

    // 5. Active workflows count
    prisma.workflow.count({
      where: { enabled: true },
    }),

    // 6. Latest 5 workflow runs
    prisma.workflowRun.findMany({
      take: 5,
      orderBy: { startedAt: 'desc' },
      include: { workflow: true },
    }),

    // 7. Recent 10 content entries
    prisma.contentEntry.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        workflow: true,
        readingItems: { where: { userId: resolvedUserId } },
      },
    }),

    // 8. Enabled workflows ordered by name
    prisma.workflow.findMany({
      where: { enabled: true },
      orderBy: { name: 'asc' },
    }),

    // 9. Last 5 failed runs
    prisma.workflowRun.findMany({
      where: { status: 'failed' },
      take: 5,
      orderBy: { startedAt: 'desc' },
      include: { workflow: true },
    }),
  ]);

  const unreadEntries = Math.max(0, totalEntries - completedEntries);

  const latestRuns: WorkflowRunResponse[] = latestRunsRaw.map((run) => ({
    id: run.id,
    workflowId: run.workflowId,
    workflow: {
      id: run.workflow.id,
      slug: run.workflow.slug,
      name: run.workflow.name,
      description: run.workflow.description,
      enabled: run.workflow.enabled,
      scheduleExpression: run.workflow.scheduleExpression,
      timezone: run.workflow.timezone,
      configuration: (run.workflow.configuration as Record<string, unknown>) || {},
      createdAt: run.workflow.createdAt.toISOString(),
      updatedAt: run.workflow.updatedAt.toISOString(),
    },
    idempotencyKey: run.idempotencyKey,
    status: run.status,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt ? run.completedAt.toISOString() : null,
    errorCode: run.errorCode,
    errorMessage: run.errorMessage,
    entriesCreated: run.entriesCreated,
    triggerSource: run.triggerSource,
    metadata: (run.metadata as Record<string, unknown>) || {},
  }));

  const failedRuns: WorkflowRunResponse[] = failedRunsRaw.map((run) => ({
    id: run.id,
    workflowId: run.workflowId,
    workflow: {
      id: run.workflow.id,
      slug: run.workflow.slug,
      name: run.workflow.name,
      description: run.workflow.description,
      enabled: run.workflow.enabled,
      scheduleExpression: run.workflow.scheduleExpression,
      timezone: run.workflow.timezone,
      configuration: (run.workflow.configuration as Record<string, unknown>) || {},
      createdAt: run.workflow.createdAt.toISOString(),
      updatedAt: run.workflow.updatedAt.toISOString(),
    },
    idempotencyKey: run.idempotencyKey,
    status: run.status,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt ? run.completedAt.toISOString() : null,
    errorCode: run.errorCode,
    errorMessage: run.errorMessage,
    entriesCreated: run.entriesCreated,
    triggerSource: run.triggerSource,
    metadata: (run.metadata as Record<string, unknown>) || {},
  }));

  const recentContent: ContentEntryResponse[] = recentContentRaw.map((entry) => {
    const readingItem = entry.readingItems[0];
    return {
      id: entry.id,
      workflowId: entry.workflowId,
      workflow: {
        id: entry.workflow.id,
        slug: entry.workflow.slug,
        name: entry.workflow.name,
        description: entry.workflow.description,
        enabled: entry.workflow.enabled,
        scheduleExpression: entry.workflow.scheduleExpression,
        timezone: entry.workflow.timezone,
        configuration: (entry.workflow.configuration as Record<string, unknown>) || {},
        createdAt: entry.workflow.createdAt.toISOString(),
        updatedAt: entry.workflow.updatedAt.toISOString(),
      },
      title: entry.title,
      slug: entry.slug,
      summary: entry.summary,
      contentMarkdown: entry.contentMarkdown,
      contentFormat: entry.contentFormat,
      category: entry.category,
      tags: entry.tags,
      sourceUrls: entry.sourceUrls,
      generatedAt: entry.generatedAt.toISOString(),
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
      revisionNumber: entry.revisionNumber,
      metadata: (entry.metadata as Record<string, unknown>) || {},
      isRead: readingItem?.status === 'completed',
      isSaved: !!readingItem,
      readingListItem: readingItem
        ? {
            id: readingItem.id,
            userId: readingItem.userId,
            contentEntryId: readingItem.contentEntryId,
            status: readingItem.status,
            savedAt: readingItem.savedAt.toISOString(),
            startedAt: readingItem.startedAt ? readingItem.startedAt.toISOString() : null,
            completedAt: readingItem.completedAt ? readingItem.completedAt.toISOString() : null,
            personalNote: readingItem.personalNote,
          }
        : null,
      estimatedReadingTime: Math.max(1, Math.ceil(entry.contentMarkdown.split(/\s+/).length / 200)),
    };
  });

  const upcomingWorkflows: WorkflowResponse[] = upcomingWorkflowsRaw.map((wf) => ({
    id: wf.id,
    slug: wf.slug,
    name: wf.name,
    description: wf.description,
    enabled: wf.enabled,
    scheduleExpression: wf.scheduleExpression,
    timezone: wf.timezone,
    configuration: (wf.configuration as Record<string, unknown>) || {},
    createdAt: wf.createdAt.toISOString(),
    updatedAt: wf.updatedAt.toISOString(),
  }));

  return {
    totalEntries,
    unreadEntries,
    completedEntries,
    savedForLater,
    todayEntries,
    activeWorkflows,
    latestRuns,
    recentContent,
    upcomingWorkflows,
    failedRuns,
  };
}
