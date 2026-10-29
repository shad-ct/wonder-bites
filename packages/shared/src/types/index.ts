import type { z } from 'zod';
import type {
  WorkflowSlugSchema,
  ReadingStatusSchema,
  RunStatusSchema,
  ContentEntryCreateSchema,
  ContentEntryUpdateSchema,
  ContentSearchSchema,
  PaginationQuerySchema,
  WorkflowRunStartSchema,
  WorkflowRunCompleteSchema,
  WorkflowRunQuerySchema,
  LoginSchema,
  WorkflowUpdateSchema,
  UserSettingsSchema,
} from '../schemas/index.js';

// ─── Inferred Schema Types ────────────────────────────────────────────────────

export type WorkflowSlug = z.infer<typeof WorkflowSlugSchema>;
export type ReadingStatus = z.infer<typeof ReadingStatusSchema>;
export type RunStatus = z.infer<typeof RunStatusSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type ContentEntryCreate = z.infer<typeof ContentEntryCreateSchema>;
export type ContentEntryUpdate = z.infer<typeof ContentEntryUpdateSchema>;
export type ContentSearchParams = z.infer<typeof ContentSearchSchema>;
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
export type WorkflowUpdate = z.infer<typeof WorkflowUpdateSchema>;
export type WorkflowRunStart = z.infer<typeof WorkflowRunStartSchema>;
export type WorkflowRunComplete = z.infer<typeof WorkflowRunCompleteSchema>;
export type WorkflowRunQuery = z.infer<typeof WorkflowRunQuerySchema>;
export type UserSettings = z.infer<typeof UserSettingsSchema>;

// ─── API Response Types ────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  success: false;
  error: string;
  code: string;
  details?: unknown;
}

// ─── Domain Models (API response shapes) ───────────────────────────────────────

export interface WorkflowResponse {
  id: string;
  slug: string;
  name: string;
  description: string;
  enabled: boolean;
  scheduleExpression: string;
  timezone: string;
  configuration: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  lastRun?: WorkflowRunResponse | null;
  totalRuns?: number;
  successfulRuns?: number;
  failedRuns?: number;
  totalEntries?: number;
}

export interface ContentEntryResponse {
  id: string;
  workflowId: string;
  workflow?: WorkflowResponse;
  title: string;
  slug: string;
  summary: string;
  contentMarkdown: string;
  contentFormat: string;
  category: string;
  tags: string[];
  sourceUrls: string[];
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
  revisionNumber: number;
  metadata: Record<string, unknown>;
  isRead?: boolean;
  isSaved?: boolean;
  readingListItem?: ReadingListItemResponse | null;
  estimatedReadingTime?: number;
}

export interface ContentRevisionResponse {
  id: string;
  contentEntryId: string;
  revisionNumber: number;
  previousContent: string;
  changedAt: string;
  changeSource: string;
}

export interface ReadingListItemResponse {
  id: string;
  userId: string;
  contentEntryId: string;
  contentEntry?: ContentEntryResponse;
  status: string;
  savedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  personalNote: string | null;
}

export interface WorkflowRunResponse {
  id: string;
  workflowId: string;
  workflow?: WorkflowResponse;
  idempotencyKey: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  entriesCreated: number;
  triggerSource: string;
  metadata: Record<string, unknown>;
}

export interface AuditLogResponse {
  id: string;
  actorType: string;
  action: string;
  resourceType: string;
  resourceId: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface DashboardSummary {
  totalEntries: number;
  unreadEntries: number;
  completedEntries: number;
  savedForLater: number;
  todayEntries: number;
  activeWorkflows: number;
  latestRuns: WorkflowRunResponse[];
  recentContent: ContentEntryResponse[];
  upcomingWorkflows: WorkflowResponse[];
  failedRuns: WorkflowRunResponse[];
}

export interface UserResponse {
  id: string;
  username: string;
  timezone: string;
  preferences: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ─── MCP Types ─────────────────────────────────────────────────────────────────

export interface McpToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  code?: string;
}
