import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { generateUniqueSlug } from '../lib/slug.js';
import type {
  ContentEntryCreate,
  ContentEntryUpdate,
  ContentSearchParams,
  ContentEntryResponse,
  ContentRevisionResponse,
  PaginatedResponse,
} from '@wonder-bites/shared';

/**
 * Estimate reading time in minutes based on 200 words/min average.
 */
function calculateReadingTime(markdown: string): number {
  const words = markdown.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

export interface ContentEntryLike {
  id: string;
  workflowId: string;
  workflow?: {
    id: string;
    slug: string;
    name: string;
    description: string;
    enabled: boolean;
    scheduleExpression: string;
    timezone: string;
    configuration: unknown;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  title: string;
  slug: string;
  summary: string;
  contentMarkdown: string;
  contentFormat: string;
  category: string;
  tags: string[];
  sourceUrls: string[];
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  revisionNumber: number;
  metadata: unknown;
  readingItems?: Array<{
    id: string;
    userId: string;
    contentEntryId: string;
    status: string;
    savedAt: Date;
    startedAt: Date | null;
    completedAt: Date | null;
    personalNote: string | null;
  }>;
}

/**
 * Format a content entry record to API response format.
 */
function formatContentEntry(
  entry: ContentEntryLike,
  userId?: string
): ContentEntryResponse {
  const userReadingItem = userId && entry.readingItems
    ? entry.readingItems.find((item) => item.userId === userId)
    : entry.readingItems?.[0];

  const isSaved = !!userReadingItem;
  const isRead = userReadingItem?.status === 'completed';

  return {
    id: entry.id,
    workflowId: entry.workflowId,
    workflow: entry.workflow
      ? {
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
        }
      : undefined,
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
    isRead,
    isSaved,
    readingListItem: userReadingItem
      ? {
          id: userReadingItem.id,
          userId: userReadingItem.userId,
          contentEntryId: userReadingItem.contentEntryId,
          status: userReadingItem.status,
          savedAt: userReadingItem.savedAt.toISOString(),
          startedAt: userReadingItem.startedAt ? userReadingItem.startedAt.toISOString() : null,
          completedAt: userReadingItem.completedAt ? userReadingItem.completedAt.toISOString() : null,
          personalNote: userReadingItem.personalNote,
        }
      : null,
    estimatedReadingTime: calculateReadingTime(entry.contentMarkdown),
  };
}

/**
 * Publish a new content entry.
 * Validates workflow, checks idempotencyKey, generates slug, and logs audit event in a transaction.
 */
export async function publishContentEntry(
  data: ContentEntryCreate,
  actorType: 'mcp' | 'user' | 'system' = 'mcp'
): Promise<ContentEntryResponse> {
  // Check if entry with this idempotency key already exists
  if (data.idempotencyKey) {
    const existing = await prisma.contentEntry.findUnique({
      where: { idempotencyKey: data.idempotencyKey },
      include: { workflow: true, readingItems: true },
    });
    if (existing) {
      return formatContentEntry(existing);
    }
  }

  // Find workflow
  const workflow = await prisma.workflow.findUnique({
    where: { slug: data.workflowSlug },
  });
  if (!workflow) {
    throw new Error(`Workflow with slug "${data.workflowSlug}" not found`);
  }

  // Generate unique slug
  const slug = await generateUniqueSlug(data.title);
  const generatedAt = typeof data.generatedAt === 'string' ? new Date(data.generatedAt) : data.generatedAt;

  // Execute creation and audit in transaction
  const result = await prisma.$transaction(async (tx) => {
    const entry = await tx.contentEntry.create({
      data: {
        workflowId: workflow.id,
        title: data.title,
        slug,
        summary: data.summary || '',
        contentMarkdown: data.contentMarkdown,
        contentFormat: data.contentFormat || 'markdown',
        category: data.category || '',
        tags: data.tags || [],
        sourceUrls: data.sourceUrls || [],
        generatedAt,
        metadata: (data.metadata as Prisma.InputJsonValue) || {},
        idempotencyKey: data.idempotencyKey,
      },
      include: {
        workflow: true,
        readingItems: true,
      },
    });

    await tx.auditLog.create({
      data: {
        actorType,
        action: 'publish_content_entry',
        resourceType: 'content_entry',
        resourceId: entry.id,
        metadata: {
          workflowSlug: data.workflowSlug,
          title: data.title,
          slug: entry.slug,
          idempotencyKey: data.idempotencyKey,
        },
      },
    });

    return entry;
  });

  return formatContentEntry(result);
}

/**
 * Update an existing content entry.
 * Creates ContentRevision with previous content and increments revisionNumber.
 */
export async function updateContentEntry(
  id: string,
  data: ContentEntryUpdate,
  actorType: 'user' | 'mcp' | 'system' = 'user'
): Promise<ContentEntryResponse> {
  const existing = await prisma.contentEntry.findUnique({
    where: { id },
    include: { workflow: true, readingItems: true },
  });

  if (!existing) {
    throw new Error(`Content entry with ID "${id}" not found`);
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Create revision record for current state before changes
    await tx.contentRevision.create({
      data: {
        contentEntryId: existing.id,
        revisionNumber: existing.revisionNumber,
        previousContent: existing.contentMarkdown,
        changeSource: data.changeSource || actorType,
      },
    });

    // 2. Prepare update data
    const updatePayload: Prisma.ContentEntryUpdateInput = {
      revisionNumber: { increment: 1 },
    };

    if (data.title !== undefined) updatePayload.title = data.title;
    if (data.summary !== undefined) updatePayload.summary = data.summary;
    if (data.contentMarkdown !== undefined) updatePayload.contentMarkdown = data.contentMarkdown;
    if (data.category !== undefined) updatePayload.category = data.category;
    if (data.tags !== undefined) updatePayload.tags = data.tags;
    if (data.sourceUrls !== undefined) updatePayload.sourceUrls = data.sourceUrls;
    if (data.metadata !== undefined) {
      updatePayload.metadata = {
        ...((existing.metadata as Record<string, unknown>) || {}),
        ...(data.metadata || {}),
      } as Prisma.InputJsonValue;
    }

    // 3. Update entry
    const updated = await tx.contentEntry.update({
      where: { id },
      data: updatePayload,
      include: {
        workflow: true,
        readingItems: true,
      },
    });

    // 4. Log audit entry
    await tx.auditLog.create({
      data: {
        actorType,
        action: 'update_content_entry',
        resourceType: 'content_entry',
        resourceId: updated.id,
        metadata: {
          revisionNumber: updated.revisionNumber,
          changeSource: data.changeSource || actorType,
        },
      },
    });

    return updated;
  });

  return formatContentEntry(result);
}

/**
 * Get single content entry by ID.
 */
export async function getContentEntry(id: string, userId?: string): Promise<ContentEntryResponse | null> {
  const entry = await prisma.contentEntry.findUnique({
    where: { id },
    include: {
      workflow: true,
      readingItems: userId ? { where: { userId } } : true,
      _count: { select: { revisions: true } },
    },
  });

  if (!entry) return null;
  return formatContentEntry(entry, userId);
}

/**
 * Get single content entry by Slug.
 */
export async function getContentEntryBySlug(slug: string, userId?: string): Promise<ContentEntryResponse | null> {
  const entry = await prisma.contentEntry.findUnique({
    where: { slug },
    include: {
      workflow: true,
      readingItems: userId ? { where: { userId } } : true,
      _count: { select: { revisions: true } },
    },
  });

  if (!entry) return null;
  return formatContentEntry(entry, userId);
}

/**
 * Get revisions history for a content entry.
 */
export async function getContentRevisions(contentEntryId: string): Promise<ContentRevisionResponse[]> {
  const revisions = await prisma.contentRevision.findMany({
    where: { contentEntryId },
    orderBy: { revisionNumber: 'desc' },
  });

  return revisions.map((rev) => ({
    id: rev.id,
    contentEntryId: rev.contentEntryId,
    revisionNumber: rev.revisionNumber,
    previousContent: rev.previousContent,
    changedAt: rev.changedAt.toISOString(),
    changeSource: rev.changeSource,
  }));
}

/**
 * List content entries with filters and pagination.
 */
export async function listContentEntries(
  params: ContentSearchParams,
  userId?: string
): Promise<PaginatedResponse<ContentEntryResponse>> {
  const page = params.page || 1;
  const pageSize = params.pageSize || 20;
  const skip = (page - 1) * pageSize;

  const where: Prisma.ContentEntryWhereInput = {};

  if (params.workflowSlug) {
    where.workflow = { slug: params.workflowSlug };
  }

  if (params.category) {
    where.category = { contains: params.category, mode: 'insensitive' };
  }

  if (params.tags && params.tags.length > 0) {
    where.tags = { hasSome: params.tags };
  }

  if (params.dateFrom || params.dateTo) {
    where.generatedAt = {};
    if (params.dateFrom) where.generatedAt.gte = new Date(params.dateFrom);
    if (params.dateTo) where.generatedAt.lte = new Date(params.dateTo);
  }

  if (params.query) {
    where.OR = [
      { title: { contains: params.query, mode: 'insensitive' } },
      { summary: { contains: params.query, mode: 'insensitive' } },
      { contentMarkdown: { contains: params.query, mode: 'insensitive' } },
    ];
  }

  if (params.isRead !== undefined && userId) {
    if (params.isRead) {
      where.readingItems = {
        some: {
          userId,
          status: 'completed',
        },
      };
    } else {
      where.OR = [
        ...(where.OR || []),
        { readingItems: { none: { userId } } },
        { readingItems: { some: { userId, status: { not: 'completed' } } } },
      ];
    }
  }

  const [total, entries] = await Promise.all([
    prisma.contentEntry.count({ where }),
    prisma.contentEntry.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { generatedAt: 'desc' },
      include: {
        workflow: true,
        readingItems: userId ? { where: { userId } } : true,
      },
    }),
  ]);

  const totalPages = Math.ceil(total / pageSize) || 1;

  return {
    success: true,
    data: entries.map((entry) => formatContentEntry(entry, userId)),
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
    },
  };
}

/**
 * Full-text search across content entries.
 */
export async function searchContent(
  query?: string,
  page = 1,
  pageSize = 20,
  userId?: string
): Promise<PaginatedResponse<ContentEntryResponse>> {
  const where: Prisma.ContentEntryWhereInput = {};

  if (query && query.trim().length > 0) {
    const q = query.trim();
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { summary: { contains: q, mode: 'insensitive' } },
      { contentMarkdown: { contains: q, mode: 'insensitive' } },
    ];
  }

  const skip = (page - 1) * pageSize;

  const [total, entries] = await Promise.all([
    prisma.contentEntry.count({ where }),
    prisma.contentEntry.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { generatedAt: 'desc' },
      include: {
        workflow: true,
        readingItems: userId ? { where: { userId } } : true,
      },
    }),
  ]);

  const totalPages = Math.ceil(total / pageSize) || 1;

  return {
    success: true,
    data: entries.map((entry) => formatContentEntry(entry, userId)),
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
    },
  };
}

/**
 * Delete a content entry and all its related records (revisions, reading list items, audit logs).
 */
export async function deleteContentEntry(id: string, userId: string): Promise<boolean> {
  const existing = await prisma.contentEntry.findUnique({ where: { id } });
  if (!existing) return false;

  await prisma.$transaction(async (tx) => {
    await tx.auditLog.deleteMany({ where: { resourceType: 'content_entry', resourceId: id } });
    await tx.contentEntry.delete({ where: { id } });
  });

  return true;
}

/**
 * Get recent content entries within lookback window.
 */
export async function getRecentEntries(
  workflowSlugs?: string[],
  lookbackDays = 7,
  limit = 20,
  userId?: string
): Promise<ContentEntryResponse[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);

  const where: Prisma.ContentEntryWhereInput = {
    generatedAt: { gte: cutoffDate },
  };

  if (workflowSlugs && workflowSlugs.length > 0) {
    where.workflow = { slug: { in: workflowSlugs } };
  }

  const entries = await prisma.contentEntry.findMany({
    where,
    take: limit,
    orderBy: { generatedAt: 'desc' },
    include: {
      workflow: true,
      readingItems: userId ? { where: { userId } } : true,
    },
  });

  return entries.map((entry) => formatContentEntry(entry, userId));
}
