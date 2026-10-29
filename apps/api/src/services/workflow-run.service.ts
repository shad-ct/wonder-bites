import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import type {
  WorkflowRunStart,
  WorkflowRunComplete,
  WorkflowRunQuery,
  WorkflowRunResponse,
  PaginatedResponse,
} from '@wonder-bites/shared';

/**
 * Format Prisma WorkflowRun model into API response format.
 */
function formatWorkflowRun(
  run: Prisma.WorkflowRunGetPayload<{ include: { workflow: true } }>
): WorkflowRunResponse {
  return {
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
  };
}

/**
 * Start a workflow run (idempotent on idempotencyKey).
 */
export async function startWorkflowRun(data: WorkflowRunStart): Promise<WorkflowRunResponse> {
  const existing = await prisma.workflowRun.findUnique({
    where: { idempotencyKey: data.idempotencyKey },
    include: { workflow: true },
  });

  if (existing) {
    return formatWorkflowRun(existing);
  }

  const workflow = await prisma.workflow.findUnique({
    where: { slug: data.workflowSlug },
  });

  if (!workflow) {
    throw new Error(`Workflow with slug "${data.workflowSlug}" not found`);
  }

  const run = await prisma.workflowRun.create({
    data: {
      workflowId: workflow.id,
      idempotencyKey: data.idempotencyKey,
      status: 'running',
      triggerSource: data.triggerSource || 'mcp',
      metadata: (data.metadata as Prisma.InputJsonValue) || {},
    },
    include: { workflow: true },
  });

  await prisma.auditLog.create({
    data: {
      actorType: data.triggerSource === 'mcp' ? 'mcp' : 'system',
      action: 'start_workflow_run',
      resourceType: 'workflow_run',
      resourceId: run.id,
      metadata: { workflowSlug: data.workflowSlug, idempotencyKey: data.idempotencyKey },
    },
  });

  return formatWorkflowRun(run);
}

/**
 * Complete a workflow run and record audit log.
 */
export async function completeWorkflowRun(data: WorkflowRunComplete): Promise<WorkflowRunResponse> {
  const existing = await prisma.workflowRun.findUnique({
    where: { id: data.runId },
    include: { workflow: true },
  });

  if (!existing) {
    throw new Error(`Workflow run with ID "${data.runId}" not found`);
  }

  const updated = await prisma.workflowRun.update({
    where: { id: data.runId },
    data: {
      status: data.status,
      completedAt: new Date(),
      entriesCreated: data.entriesCreated ?? 0,
      errorCode: data.errorCode ?? null,
      errorMessage: data.errorMessage ?? null,
      metadata: {
        ...((existing.metadata as Record<string, unknown>) || {}),
        ...((data.metadata as Record<string, unknown>) || {}),
      } as Prisma.InputJsonValue,
    },
    include: { workflow: true },
  });

  await prisma.auditLog.create({
    data: {
      actorType: 'mcp',
      action: 'complete_workflow_run',
      resourceType: 'workflow_run',
      resourceId: updated.id,
      metadata: {
        status: data.status,
        entriesCreated: data.entriesCreated,
        errorCode: data.errorCode,
      },
    },
  });

  return formatWorkflowRun(updated);
}

/**
 * Get single workflow run by ID.
 */
export async function getWorkflowRun(id: string): Promise<WorkflowRunResponse | null> {
  const run = await prisma.workflowRun.findUnique({
    where: { id },
    include: { workflow: true },
  });

  if (!run) return null;
  return formatWorkflowRun(run);
}

/**
 * List workflow runs with filtering and pagination.
 */
export async function listWorkflowRuns(
  query: WorkflowRunQuery
): Promise<PaginatedResponse<WorkflowRunResponse>> {
  const page = query.page || 1;
  const pageSize = query.pageSize || 20;
  const skip = (page - 1) * pageSize;

  const where: Prisma.WorkflowRunWhereInput = {};

  if (query.workflowSlug) {
    where.workflow = { slug: query.workflowSlug };
  }

  if (query.status) {
    where.status = query.status;
  }

  if (query.dateFrom || query.dateTo) {
    where.startedAt = {};
    if (query.dateFrom) where.startedAt.gte = new Date(query.dateFrom);
    if (query.dateTo) where.startedAt.lte = new Date(query.dateTo);
  }

  const [total, runs] = await Promise.all([
    prisma.workflowRun.count({ where }),
    prisma.workflowRun.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { startedAt: 'desc' },
      include: { workflow: true },
    }),
  ]);

  const totalPages = Math.ceil(total / pageSize) || 1;

  return {
    success: true,
    data: runs.map(formatWorkflowRun),
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
    },
  };
}
