import { prisma } from '../lib/prisma.js';
import {
  MATH_MODULES,
  CONCEPT_DOMAINS,
  MIND_SIGNAL_CATEGORIES,
  type WorkflowSlug,
} from '@wonder-bites/shared';

export interface WorkflowContextResult {
  workflowSlug: WorkflowSlug;
  context: Record<string, unknown>;
}

/**
 * Generates context for the next run of a specific workflow.
 */
export async function getNextWorkflowContext(workflowSlug: WorkflowSlug): Promise<WorkflowContextResult> {
  const workflow = await prisma.workflow.findUnique({
    where: { slug: workflowSlug },
    include: {
      entries: {
        orderBy: { generatedAt: 'desc' },
        take: 15,
      },
    },
  });

  const recentEntries = workflow?.entries || [];
  const config = (workflow?.configuration as Record<string, unknown>) || {};

  switch (workflowSlug) {
    case 'math-practice': {
      const currentModuleNumber = (config.currentModule as number) || 1;
      const completedModules = (config.completedModules as number[]) || [];
      const currentModuleInfo = MATH_MODULES.find((m) => m.number === currentModuleNumber) || MATH_MODULES[0];

      const lastEntryTopics = recentEntries.slice(0, 5).map((e) => ({
        title: e.title,
        category: e.category,
        tags: e.tags,
        generatedAt: e.generatedAt.toISOString(),
      }));

      return {
        workflowSlug,
        context: {
          currentModule: currentModuleNumber,
          currentModuleName: currentModuleInfo?.name || 'Functions as Models',
          currentModuleDomains: currentModuleInfo?.domains || ['Algebra'],
          completedModules,
          totalModules: MATH_MODULES.length,
          lastEntryTopics,
        },
      };
    }

    case 'concept-of-the-day': {
      const recentDomainsUsed = recentEntries
        .slice(0, 10)
        .map((e) => e.category || (e.metadata as Record<string, unknown>)?.domain as string)
        .filter(Boolean);

      const recentTopics = recentEntries.slice(0, 10).map((e) => e.title);

      // Determine next domain in rotation
      const lastDomain = recentDomainsUsed[0];
      const lastIndex = lastDomain ? CONCEPT_DOMAINS.indexOf(lastDomain as any) : -1;
      const nextDomain = CONCEPT_DOMAINS[(lastIndex + 1) % CONCEPT_DOMAINS.length];

      return {
        workflowSlug,
        context: {
          recentDomainsUsed,
          recentTopics,
          suggestedNextDomain: nextDomain,
          availableDomains: CONCEPT_DOMAINS,
        },
      };
    }

    case 'mind-signal': {
      const recentCategories = recentEntries
        .slice(0, 10)
        .map((e) => e.category)
        .filter(Boolean);

      const recentTopics = recentEntries.slice(0, 10).map((e) => e.title);

      const lastCategory = recentCategories[0];
      const lastIndex = lastCategory ? MIND_SIGNAL_CATEGORIES.indexOf(lastCategory as any) : -1;
      const nextCategory = MIND_SIGNAL_CATEGORIES[(lastIndex + 1) % MIND_SIGNAL_CATEGORIES.length];

      return {
        workflowSlug,
        context: {
          recentCategories,
          recentTopics,
          suggestedNextCategory: nextCategory,
          availableCategories: MIND_SIGNAL_CATEGORIES,
        },
      };
    }

    case 'facts-and-quotes': {
      const recentSubjectAreas = Array.from(
        new Set(recentEntries.flatMap((e) => e.tags))
      ).slice(0, 20);

      const recentTopics = recentEntries.slice(0, 7).map((e) => e.title);

      return {
        workflowSlug,
        context: {
          recentSubjectAreas,
          recentTopics,
          factsPerBatch: 5,
          quotesPerBatch: 5,
        },
      };
    }

    case 'weekly-coding-challenge': {
      const recentPatterns = Array.from(
        new Set(
          recentEntries
            .map((e) => (e.metadata as Record<string, unknown>)?.pattern as string || e.category)
            .filter(Boolean)
        )
      );

      // Fetch user personal notes / feedback on challenges
      const challengeIds = recentEntries.map((e) => e.id);
      const readingItemsWithNotes = await prisma.readingListItem.findMany({
        where: {
          contentEntryId: { in: challengeIds },
          personalNote: { not: null },
        },
        select: {
          contentEntryId: true,
          personalNote: true,
          status: true,
        },
      });

      const feedbackHistory = readingItemsWithNotes.map((item) => ({
        challengeId: item.contentEntryId,
        feedback: item.personalNote,
        status: item.status,
      }));

      return {
        workflowSlug,
        context: {
          recentPatterns,
          recentChallenges: recentEntries.slice(0, 8).map((e) => ({
            title: e.title,
            tags: e.tags,
            generatedAt: e.generatedAt.toISOString(),
          })),
          feedbackHistory,
        },
      };
    }

    case 'daily-random-project-ideas': {
      const timezone = workflow?.timezone || 'Asia/Kolkata';
      // Determine day of week in timezone
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'long',
      });
      const dayOfWeek = formatter.format(now);
      const isSunday = dayOfWeek === 'Sunday';

      const recentProjects = recentEntries.slice(0, 7).map((e) => ({
        title: e.title,
        tags: e.tags,
        generatedAt: e.generatedAt.toISOString(),
      }));

      return {
        workflowSlug,
        context: {
          recentProjects,
          isSunday,
          dayOfWeek,
          roundupDue: isSunday,
          projectsPerDay: 5,
        },
      };
    }

    case 'science-signal': {
      const recentStoryTopics = recentEntries.slice(0, 7).map((e) => ({
        title: e.title,
        summary: e.summary,
        tags: e.tags,
        generatedAt: e.generatedAt.toISOString(),
      }));

      return {
        workflowSlug,
        context: {
          recentStoryTopics,
          lookbackHours: 48,
        },
      };
    }

    default: {
      return {
        workflowSlug,
        context: {
          recentEntries: recentEntries.slice(0, 5).map((e) => e.title),
        },
      };
    }
  }
}
