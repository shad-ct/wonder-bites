import crypto from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { WORKFLOW_DEFINITIONS, type WorkflowSlug } from '@wonder-bites/shared';
import type { WorkflowResponse, WorkflowUpdate } from '@wonder-bites/shared';

/**
 * Ensure all 7 predefined workflows are present in the database.
 */
export async function ensureWorkflowsExist(): Promise<void> {
  const count = await prisma.workflow.count();
  if (count < Object.keys(WORKFLOW_DEFINITIONS).length) {
    for (const [slug, def] of Object.entries(WORKFLOW_DEFINITIONS)) {
      await prisma.workflow.upsert({
        where: { slug },
        update: {},
        create: {
          slug,
          name: def.name,
          description: def.description,
          scheduleExpression: def.defaultSchedule,
          timezone: 'Asia/Kolkata',
          configuration: {},
          enabled: true,
        },
      });
    }
  }
}

/**
 * List all workflows with counts and last run info.
 */
export async function listWorkflows(): Promise<WorkflowResponse[]> {
  await ensureWorkflowsExist();

  const workflows = await prisma.workflow.findMany({
    orderBy: { name: 'asc' },
    include: {
      runs: {
        orderBy: { startedAt: 'desc' },
        take: 1,
      },
      _count: {
        select: {
          entries: true,
          runs: true,
        },
      },
    },
  });

  // Calculate success and fail counts per workflow
  const results: WorkflowResponse[] = await Promise.all(
    workflows.map(async (wf) => {
      const [successfulRuns, failedRuns] = await Promise.all([
        prisma.workflowRun.count({
          where: { workflowId: wf.id, status: 'succeeded' },
        }),
        prisma.workflowRun.count({
          where: { workflowId: wf.id, status: 'failed' },
        }),
      ]);

      const lastRun = wf.runs[0]
        ? {
            id: wf.runs[0].id,
            workflowId: wf.runs[0].workflowId,
            idempotencyKey: wf.runs[0].idempotencyKey,
            status: wf.runs[0].status,
            startedAt: wf.runs[0].startedAt.toISOString(),
            completedAt: wf.runs[0].completedAt ? wf.runs[0].completedAt.toISOString() : null,
            errorCode: wf.runs[0].errorCode,
            errorMessage: wf.runs[0].errorMessage,
            entriesCreated: wf.runs[0].entriesCreated,
            triggerSource: wf.runs[0].triggerSource,
            metadata: (wf.runs[0].metadata as Record<string, unknown>) || {},
          }
        : null;

      return {
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
        lastRun,
        totalRuns: wf._count.runs,
        successfulRuns,
        failedRuns,
        totalEntries: wf._count.entries,
      };
    })
  );

  return results;
}

/**
 * Get detailed stats and information for a single workflow.
 */
export async function getWorkflow(slug: string): Promise<WorkflowResponse | null> {
  await ensureWorkflowsExist();

  const wf = await prisma.workflow.findUnique({
    where: { slug },
    include: {
      runs: {
        orderBy: { startedAt: 'desc' },
        take: 1,
      },
      _count: {
        select: {
          entries: true,
          runs: true,
        },
      },
    },
  });

  if (!wf) return null;

  const [successfulRuns, failedRuns] = await Promise.all([
    prisma.workflowRun.count({
      where: { workflowId: wf.id, status: 'succeeded' },
    }),
    prisma.workflowRun.count({
      where: { workflowId: wf.id, status: 'failed' },
    }),
  ]);

  const lastRun = wf.runs[0]
    ? {
        id: wf.runs[0].id,
        workflowId: wf.runs[0].workflowId,
        idempotencyKey: wf.runs[0].idempotencyKey,
        status: wf.runs[0].status,
        startedAt: wf.runs[0].startedAt.toISOString(),
        completedAt: wf.runs[0].completedAt ? wf.runs[0].completedAt.toISOString() : null,
        errorCode: wf.runs[0].errorCode,
        errorMessage: wf.runs[0].errorMessage,
        entriesCreated: wf.runs[0].entriesCreated,
        triggerSource: wf.runs[0].triggerSource,
        metadata: (wf.runs[0].metadata as Record<string, unknown>) || {},
      }
    : null;

  return {
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
    lastRun,
    totalRuns: wf._count.runs,
    successfulRuns,
    failedRuns,
    totalEntries: wf._count.entries,
  };
}

/**
 * Update workflow settings and configuration.
 */
export async function updateWorkflow(slug: string, data: WorkflowUpdate): Promise<WorkflowResponse | null> {
  const existing = await prisma.workflow.findUnique({ where: { slug } });
  if (!existing) return null;

  const updateData: Prisma.WorkflowUpdateInput = {};
  if (typeof data.enabled === 'boolean') updateData.enabled = data.enabled;
  if (data.scheduleExpression) updateData.scheduleExpression = data.scheduleExpression;
  if (data.timezone) updateData.timezone = data.timezone;
  if (data.configuration !== undefined) {
    updateData.configuration = data.configuration as Prisma.InputJsonValue;
  }

  await prisma.workflow.update({
    where: { slug },
    data: updateData,
  });

  return getWorkflow(slug);
}

/**
 * Trigger a workflow manually by creating a queued workflow run.
 */
export async function triggerWorkflow(slug: string, triggerSource: 'manual' | 'scheduled' | 'mcp' = 'manual') {
  const workflow = await prisma.workflow.findUnique({ where: { slug } });
  if (!workflow) {
    throw new Error(`Workflow with slug "${slug}" not found`);
  }

  const idempotencyKey = `${triggerSource}-${slug}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  const run = await prisma.workflowRun.create({
    data: {
      workflowId: workflow.id,
      idempotencyKey,
      status: 'queued',
      triggerSource,
      metadata: { triggeredAt: new Date().toISOString() },
    },
    include: {
      workflow: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorType: triggerSource === 'manual' ? 'user' : triggerSource,
      action: 'trigger_workflow',
      resourceType: 'workflow_run',
      resourceId: run.id,
      metadata: { workflowSlug: slug, idempotencyKey },
    },
  });

  return {
    id: run.id,
    workflowId: run.workflowId,
    workflowSlug: workflow.slug,
    workflowName: workflow.name,
    idempotencyKey: run.idempotencyKey,
    status: run.status,
    startedAt: run.startedAt.toISOString(),
    completedAt: null,
    errorCode: null,
    errorMessage: null,
    entriesCreated: run.entriesCreated,
    triggerSource: run.triggerSource,
    metadata: (run.metadata as Record<string, unknown>) || {},
  };
}
