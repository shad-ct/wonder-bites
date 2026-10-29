import { prisma } from '../lib/prisma.js';

/**
 * Format entry with YAML frontmatter.
 */
function createFrontmatterMarkdown(entry: {
  title: string;
  slug: string;
  workflowSlug: string;
  category: string;
  tags: string[];
  generatedAt: Date;
  summary: string;
  sourceUrls: string[];
  contentMarkdown: string;
}): string {
  const frontmatter = [
    '---',
    `title: "${entry.title.replace(/"/g, '\\"')}"`,
    `slug: "${entry.slug}"`,
    `workflow: "${entry.workflowSlug}"`,
    `category: "${entry.category}"`,
    `generated_at: "${entry.generatedAt.toISOString()}"`,
    `summary: "${(entry.summary || '').replace(/"/g, '\\"')}"`,
    `tags: [${entry.tags.map((t) => `"${t}"`).join(', ')}]`,
    `sources: [${entry.sourceUrls.map((s) => `"${s}"`).join(', ')}]`,
    '---',
    '',
    entry.contentMarkdown,
  ].join('\n');

  return frontmatter;
}

/**
 * Export single entry as formatted Markdown with frontmatter.
 */
export async function exportEntryMarkdown(id: string): Promise<{ filename: string; content: string } | null> {
  const entry = await prisma.contentEntry.findUnique({
    where: { id },
    include: { workflow: true },
  });

  if (!entry) return null;

  const markdown = createFrontmatterMarkdown({
    title: entry.title,
    slug: entry.slug,
    workflowSlug: entry.workflow.slug,
    category: entry.category,
    tags: entry.tags,
    generatedAt: entry.generatedAt,
    summary: entry.summary,
    sourceUrls: entry.sourceUrls,
    contentMarkdown: entry.contentMarkdown,
  });

  return {
    filename: `${entry.slug}.md`,
    content: markdown,
  };
}

/**
 * Export workflow history either as Markdown or JSON.
 */
export async function exportWorkflowHistory(
  slug: string,
  format: 'markdown' | 'json' = 'json'
): Promise<{ filename: string; content: string; contentType: string } | null> {
  const workflow = await prisma.workflow.findUnique({
    where: { slug },
    include: {
      entries: {
        orderBy: { generatedAt: 'desc' },
      },
      runs: {
        orderBy: { startedAt: 'desc' },
      },
    },
  });

  if (!workflow) return null;

  if (format === 'markdown') {
    const sections: string[] = [
      `# Workflow: ${workflow.name} (${workflow.slug})`,
      `\n*Description:* ${workflow.description}\n`,
      `## Content Entries (${workflow.entries.length})\n`,
    ];

    for (const entry of workflow.entries) {
      sections.push(
        `### ${entry.title}`,
        `*Date:* ${entry.generatedAt.toISOString()} | *Category:* ${entry.category} | *Tags:* ${entry.tags.join(', ')}`,
        `\n${entry.contentMarkdown}\n`,
        '---\n'
      );
    }

    return {
      filename: `${workflow.slug}-history.md`,
      content: sections.join('\n'),
      contentType: 'text/markdown; charset=utf-8',
    };
  }

  return {
    filename: `${workflow.slug}-history.json`,
    content: JSON.stringify(workflow, null, 2),
    contentType: 'application/json',
  };
}

/**
 * Export full library as JSON.
 */
export async function exportFullLibrary(): Promise<{ filename: string; content: string }> {
  const [workflows, entries] = await Promise.all([
    prisma.workflow.findMany({
      orderBy: { name: 'asc' },
    }),
    prisma.contentEntry.findMany({
      orderBy: { generatedAt: 'desc' },
      include: {
        revisions: true,
      },
    }),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    workflowsCount: workflows.length,
    entriesCount: entries.length,
    workflows,
    entries,
  };

  return {
    filename: `personal-learning-hub-library-${new Date().toISOString().split('T')[0]}.json`,
    content: JSON.stringify(payload, null, 2),
  };
}

/**
 * Export reading list with completion state and personal notes.
 */
export async function exportReadingList(userId: string): Promise<{ filename: string; content: string }> {
  const readingList = await prisma.readingListItem.findMany({
    where: { userId },
    orderBy: { savedAt: 'desc' },
    include: {
      contentEntry: {
        include: {
          workflow: true,
        },
      },
    },
  });

  const payload = {
    exportedAt: new Date().toISOString(),
    userId,
    totalItems: readingList.length,
    items: readingList.map((item) => ({
      id: item.id,
      status: item.status,
      savedAt: item.savedAt.toISOString(),
      startedAt: item.startedAt?.toISOString() || null,
      completedAt: item.completedAt?.toISOString() || null,
      personalNote: item.personalNote,
      entry: {
        id: item.contentEntry.id,
        workflowSlug: item.contentEntry.workflow.slug,
        title: item.contentEntry.title,
        slug: item.contentEntry.slug,
        category: item.contentEntry.category,
        tags: item.contentEntry.tags,
        generatedAt: item.contentEntry.generatedAt.toISOString(),
        sourceUrls: item.contentEntry.sourceUrls,
      },
    })),
  };

  return {
    filename: `reading-list-${new Date().toISOString().split('T')[0]}.json`,
    content: JSON.stringify(payload, null, 2),
  };
}
