import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import type {
  ReadingListItemResponse,
  ReadingStatus,
  PaginatedResponse,
} from '@wonder-bites/shared';

/**
 * Format Prisma ReadingListItem into API response format.
 */
function formatReadingListItem(
  item: Prisma.ReadingListItemGetPayload<{
    include: {
      contentEntry: {
        include: {
          workflow: true;
        };
      };
    };
  }>
): ReadingListItemResponse {
  return {
    id: item.id,
    userId: item.userId,
    contentEntryId: item.contentEntryId,
    contentEntry: {
      id: item.contentEntry.id,
      workflowId: item.contentEntry.workflowId,
      workflow: {
        id: item.contentEntry.workflow.id,
        slug: item.contentEntry.workflow.slug,
        name: item.contentEntry.workflow.name,
        description: item.contentEntry.workflow.description,
        enabled: item.contentEntry.workflow.enabled,
        scheduleExpression: item.contentEntry.workflow.scheduleExpression,
        timezone: item.contentEntry.workflow.timezone,
        configuration: (item.contentEntry.workflow.configuration as Record<string, unknown>) || {},
        createdAt: item.contentEntry.workflow.createdAt.toISOString(),
        updatedAt: item.contentEntry.workflow.updatedAt.toISOString(),
      },
      title: item.contentEntry.title,
      slug: item.contentEntry.slug,
      summary: item.contentEntry.summary,
      contentMarkdown: item.contentEntry.contentMarkdown,
      contentFormat: item.contentEntry.contentFormat,
      category: item.contentEntry.category,
      tags: item.contentEntry.tags,
      sourceUrls: item.contentEntry.sourceUrls,
      generatedAt: item.contentEntry.generatedAt.toISOString(),
      createdAt: item.contentEntry.createdAt.toISOString(),
      updatedAt: item.contentEntry.updatedAt.toISOString(),
      revisionNumber: item.contentEntry.revisionNumber,
      metadata: (item.contentEntry.metadata as Record<string, unknown>) || {},
      isRead: item.status === 'completed',
      isSaved: true,
    },
    status: item.status,
    savedAt: item.savedAt.toISOString(),
    startedAt: item.startedAt ? item.startedAt.toISOString() : null,
    completedAt: item.completedAt ? item.completedAt.toISOString() : null,
    personalNote: item.personalNote,
  };
}

/**
 * Get paginated reading list for a user.
 */
export async function getReadingList(
  userId: string,
  status?: ReadingStatus,
  page = 1,
  pageSize = 20
): Promise<PaginatedResponse<ReadingListItemResponse>> {
  const where: Prisma.ReadingListItemWhereInput = { userId };
  if (status) {
    where.status = status;
  }

  const skip = (page - 1) * pageSize;

  const [total, items] = await Promise.all([
    prisma.readingListItem.count({ where }),
    prisma.readingListItem.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { savedAt: 'desc' },
      include: {
        contentEntry: {
          include: {
            workflow: true,
          },
        },
      },
    }),
  ]);

  const totalPages = Math.ceil(total / pageSize) || 1;

  return {
    success: true,
    data: items.map(formatReadingListItem),
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
    },
  };
}

/**
 * Add content entry to user's reading list.
 * Idempotent upsert on [userId, contentEntryId].
 */
export async function saveToReadingList(
  userId: string,
  contentEntryId: string
): Promise<ReadingListItemResponse> {
  // Verify content entry exists
  const entry = await prisma.contentEntry.findUnique({
    where: { id: contentEntryId },
  });
  if (!entry) {
    throw new Error(`Content entry with ID "${contentEntryId}" not found`);
  }

  const item = await prisma.readingListItem.upsert({
    where: {
      userId_contentEntryId: {
        userId,
        contentEntryId,
      },
    },
    update: {},
    create: {
      userId,
      contentEntryId,
      status: 'saved',
    },
    include: {
      contentEntry: {
        include: {
          workflow: true,
        },
      },
    },
  });

  return formatReadingListItem(item);
}

/**
 * Update reading list item by item ID or contentEntryId.
 * Sets startedAt when status becomes 'reading', completedAt when 'completed'.
 */
export async function updateReadingItem(
  userId: string,
  identifier: { id?: string; contentEntryId?: string },
  data: { status?: ReadingStatus; personalNote?: string }
): Promise<ReadingListItemResponse> {
  const where: Prisma.ReadingListItemWhereUniqueInput = identifier.id
    ? { id: identifier.id }
    : {
        userId_contentEntryId: {
          userId,
          contentEntryId: identifier.contentEntryId!,
        },
      };

  const existing = await prisma.readingListItem.findUnique({
    where,
  });

  if (!existing || existing.userId !== userId) {
    // If updating by contentEntryId and it doesn't exist yet, we can create it
    if (identifier.contentEntryId && !existing) {
      const entryExists = await prisma.contentEntry.findUnique({
        where: { id: identifier.contentEntryId },
      });
      if (!entryExists) {
        throw new Error(`Content entry "${identifier.contentEntryId}" not found`);
      }

      const now = new Date();
      const created = await prisma.readingListItem.create({
        data: {
          userId,
          contentEntryId: identifier.contentEntryId,
          status: data.status || 'saved',
          personalNote: data.personalNote,
          startedAt: data.status === 'reading' ? now : null,
          completedAt: data.status === 'completed' ? now : null,
        },
        include: {
          contentEntry: {
            include: {
              workflow: true,
            },
          },
        },
      });
      return formatReadingListItem(created);
    }
    throw new Error('Reading list item not found');
  }

  const updateData: Prisma.ReadingListItemUpdateInput = {};

  if (data.status) {
    updateData.status = data.status;
    if (data.status === 'reading' && !existing.startedAt) {
      updateData.startedAt = new Date();
    }
    if (data.status === 'completed') {
      if (!existing.startedAt) updateData.startedAt = new Date();
      updateData.completedAt = new Date();
    }
    if (data.status === 'saved') {
      updateData.completedAt = null;
    }
  }

  if (data.personalNote !== undefined) {
    updateData.personalNote = data.personalNote;
  }

  const updated = await prisma.readingListItem.update({
    where: { id: existing.id },
    data: updateData,
    include: {
      contentEntry: {
        include: {
          workflow: true,
        },
      },
    },
  });

  return formatReadingListItem(updated);
}

/**
 * Remove an item from the reading list (does not delete the ContentEntry).
 */
export async function removeFromReadingList(userId: string, id: string): Promise<boolean> {
  const item = await prisma.readingListItem.findUnique({
    where: { id },
  });

  if (!item || item.userId !== userId) {
    return false;
  }

  await prisma.readingListItem.delete({
    where: { id },
  });

  return true;
}
