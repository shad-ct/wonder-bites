import { z } from 'zod';
import {
  WORKFLOW_SLUGS,
  READING_STATUSES,
  RUN_STATUSES,
  ACTOR_TYPES,
  TRIGGER_SOURCES,
  CONTENT_FORMATS,
  PAGINATION,
} from '../constants/index.js';

// ─── Primitives ────────────────────────────────────────────────────────────────

export const WorkflowSlugSchema = z.enum(WORKFLOW_SLUGS);
export const ReadingStatusSchema = z.enum(READING_STATUSES);
export const RunStatusSchema = z.enum(RUN_STATUSES);
export const ActorTypeSchema = z.enum(ACTOR_TYPES);
export const TriggerSourceSchema = z.enum(TRIGGER_SOURCES);
export const ContentFormatSchema = z.enum(CONTENT_FORMATS);

// ─── Pagination ────────────────────────────────────────────────────────────────

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(PAGINATION.DEFAULT_PAGE),
  pageSize: z.coerce.number().int().min(1).max(PAGINATION.MAX_PAGE_SIZE).default(PAGINATION.DEFAULT_PAGE_SIZE),
});

// ─── Auth ──────────────────────────────────────────────────────────────────────

export const LoginSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(256),
});

// ─── Workflow ──────────────────────────────────────────────────────────────────

export const WorkflowConfigSchema = z.object({
  slug: WorkflowSlugSchema,
  name: z.string().min(1).max(200),
  description: z.string().max(2000).default(''),
  enabled: z.boolean().default(true),
  scheduleExpression: z.string().min(1).max(100),
  timezone: z.string().min(1).max(100),
  configuration: z.record(z.unknown()).default({}),
});

export const WorkflowUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  scheduleExpression: z.string().min(1).max(100).optional(),
  timezone: z.string().min(1).max(100).optional(),
  configuration: z.record(z.unknown()).optional(),
});

// ─── Content Entry ─────────────────────────────────────────────────────────────

export const ContentEntryCreateSchema = z.object({
  workflowSlug: WorkflowSlugSchema,
  title: z.string().min(1).max(500),
  summary: z.string().max(2000).default(''),
  contentMarkdown: z.string().min(1),
  contentFormat: ContentFormatSchema.default('markdown'),
  category: z.string().max(200).default(''),
  tags: z.array(z.string().max(100)).max(20).default([]),
  sourceUrls: z.array(z.string().url().max(2000)).max(20).default([]),
  generatedAt: z.string().datetime().or(z.date()),
  metadata: z.record(z.unknown()).default({}),
  idempotencyKey: z.string().min(1).max(200),
});

export const ContentEntryUpdateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  summary: z.string().max(2000).optional(),
  contentMarkdown: z.string().min(1).optional(),
  category: z.string().max(200).optional(),
  tags: z.array(z.string().max(100)).max(20).optional(),
  sourceUrls: z.array(z.string().url().max(2000)).max(20).optional(),
  metadata: z.record(z.unknown()).optional(),
  changeSource: z.string().max(100).default('user'),
});

export const ContentSearchSchema = z.object({
  query: z.string().max(500).optional(),
  workflowSlug: WorkflowSlugSchema.optional(),
  category: z.string().max(200).optional(),
  tags: z.array(z.string()).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  isRead: z.coerce.boolean().optional(),
}).merge(PaginationQuerySchema);

// ─── Reading List ──────────────────────────────────────────────────────────────

export const ReadingListAddSchema = z.object({
  contentEntryId: z.string().uuid(),
});

export const ReadingListUpdateSchema = z.object({
  status: ReadingStatusSchema.optional(),
  personalNote: z.string().max(5000).optional(),
});

// ─── Workflow Run ──────────────────────────────────────────────────────────────

export const WorkflowRunStartSchema = z.object({
  workflowSlug: WorkflowSlugSchema,
  idempotencyKey: z.string().min(1).max(200),
  triggerSource: TriggerSourceSchema.default('mcp'),
  metadata: z.record(z.unknown()).default({}),
});

export const WorkflowRunCompleteSchema = z.object({
  runId: z.string().uuid(),
  status: z.enum(['succeeded', 'failed']),
  entriesCreated: z.number().int().min(0).default(0),
  errorCode: z.string().max(100).optional(),
  errorMessage: z.string().max(5000).optional(),
  metadata: z.record(z.unknown()).default({}),
});

export const WorkflowRunQuerySchema = z.object({
  workflowSlug: WorkflowSlugSchema.optional(),
  status: RunStatusSchema.optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
}).merge(PaginationQuerySchema);

// ─── Settings ──────────────────────────────────────────────────────────────────

export const UserSettingsSchema = z.object({
  timezone: z.string().min(1).max(100).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  preferences: z.record(z.unknown()).optional(),
});

// ─── Export ────────────────────────────────────────────────────────────────────

export const ExportFormatSchema = z.enum(['markdown', 'json']);

// ─── MCP Tool Input Schemas ────────────────────────────────────────────────────

export const McpListWorkflowsInputSchema = z.object({});

export const McpGetWorkflowInputSchema = z.object({
  slug: WorkflowSlugSchema,
});

export const McpSearchContentInputSchema = z.object({
  workflowSlug: WorkflowSlugSchema.optional(),
  query: z.string().max(500).optional(),
  category: z.string().max(200).optional(),
  tags: z.array(z.string()).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

export const McpGetContentEntryInputSchema = z.object({
  id: z.string().uuid(),
});

export const McpGetRecentEntriesInputSchema = z.object({
  workflowSlugs: z.array(WorkflowSlugSchema).optional(),
  lookbackDays: z.number().int().min(1).max(365).default(7),
  limit: z.number().int().min(1).max(100).default(20),
});

export const McpGetReadingListInputSchema = z.object({
  status: ReadingStatusSchema.optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

export const McpGetNextWorkflowContextInputSchema = z.object({
  workflowSlug: WorkflowSlugSchema,
});

export const McpGetWorkflowRunStatusInputSchema = z.object({
  runId: z.string().uuid(),
});

export const McpPublishContentInputSchema = ContentEntryCreateSchema;

export const McpUpdateContentInputSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(500).optional(),
  summary: z.string().max(2000).optional(),
  contentMarkdown: z.string().min(1).optional(),
  category: z.string().max(200).optional(),
  tags: z.array(z.string().max(100)).max(20).optional(),
  sourceUrls: z.array(z.string().url().max(2000)).max(20).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const McpSaveToReadingListInputSchema = z.object({
  contentEntryId: z.string().uuid(),
});

export const McpUpdateReadingStatusInputSchema = z.object({
  contentEntryId: z.string().uuid(),
  status: ReadingStatusSchema,
});

export const McpAddPersonalNoteInputSchema = z.object({
  contentEntryId: z.string().uuid(),
  note: z.string().max(5000),
});

export const McpStartWorkflowRunInputSchema = WorkflowRunStartSchema;
export const McpCompleteWorkflowRunInputSchema = WorkflowRunCompleteSchema;
export const McpGetDashboardSummaryInputSchema = z.object({});
