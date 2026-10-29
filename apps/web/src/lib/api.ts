import type {
  ApiResponse,
  PaginatedResponse,
  WorkflowResponse,
  ContentEntryResponse,
  ContentRevisionResponse,
  ReadingListItemResponse,
  WorkflowRunResponse,
  DashboardSummary,
  UserResponse,
  UserSettings,
} from '@wonder-bites/shared';

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) || '';

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Common typed fetch wrapper handling headers, credentials, JSON parsing, and error normalization.
 */
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const token = localStorage.getItem('auth_token');
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (response.status === 204) {
    return {} as T;
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    if (!response.ok) {
      const text = await response.text();
      throw new ApiError(text || response.statusText, response.status);
    }
    return (await response.text()) as unknown as T;
  }

  const json = await response.json();

  if (!response.ok) {
    const errorMsg = json.error || json.message || response.statusText;
    throw new ApiError(errorMsg, response.status, json.code, json.details);
  }

  return json;
}

/**
 * Downloads a binary or text file from the server.
 */
async function downloadFile(path: string, defaultFilename: string): Promise<void> {
  const url = `${BASE_URL}${path}`;
  const token = localStorage.getItem('auth_token');
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    throw new ApiError(`Download failed: ${response.statusText}`, response.status);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition');
  let filename = defaultFilename;
  if (disposition && disposition.includes('filename=')) {
    const match = disposition.match(/filename="?([^";]+)"?/);
    if (match?.[1]) {
      filename = match[1];
    }
  }

  const objectUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(objectUrl);
}

function buildQuery(params: Record<string, unknown> = {}): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  }
  const str = searchParams.toString();
  return str ? `?${str}` : '';
}

export const api = {
  auth: {
    login: async (username: string, password: string): Promise<ApiResponse<{ user: UserResponse; token?: string }>> => {
      const res = await request<ApiResponse<{ user: UserResponse; token?: string }>>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      if (res.data?.token) {
        localStorage.setItem('auth_token', res.data.token);
      }
      return res;
    },
    logout: async (): Promise<ApiResponse<{ message: string }>> => {
      try {
        return await request<ApiResponse<{ message: string }>>('/api/auth/logout', {
          method: 'POST',
        });
      } finally {
        localStorage.removeItem('auth_token');
      }
    },
    getMe: async (): Promise<ApiResponse<UserResponse>> => {
      return request<ApiResponse<UserResponse>>('/api/auth/me');
    },
  },

  dashboard: {
    getSummary: async (): Promise<ApiResponse<DashboardSummary>> => {
      return request<ApiResponse<DashboardSummary>>('/api/dashboard/summary');
    },
  },

  content: {
    list: async (params?: {
      page?: number;
      pageSize?: number;
      workflow?: string;
      category?: string;
      tag?: string;
      search?: string;
      status?: string;
      isRead?: boolean;
      isSaved?: boolean;
      startDate?: string;
      endDate?: string;
    }): Promise<PaginatedResponse<ContentEntryResponse>> => {
      const query = buildQuery(params);
      return request<PaginatedResponse<ContentEntryResponse>>(`/api/content${query}`);
    },
    get: async (id: string): Promise<ApiResponse<ContentEntryResponse>> => {
      return request<ApiResponse<ContentEntryResponse>>(`/api/content/${id}`);
    },
    search: async (queryText: string): Promise<PaginatedResponse<ContentEntryResponse>> => {
      return request<PaginatedResponse<ContentEntryResponse>>(`/api/content/search${buildQuery({ q: queryText })}`);
    },
    update: async (
      id: string,
      data: {
        title?: string;
        contentMarkdown?: string;
        summary?: string;
        tags?: string[];
        category?: string;
      }
    ): Promise<ApiResponse<ContentEntryResponse>> => {
      return request<ApiResponse<ContentEntryResponse>>(`/api/content/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    getRevisions: async (id: string): Promise<ApiResponse<ContentRevisionResponse[]>> => {
      return request<ApiResponse<ContentRevisionResponse[]>>(`/api/content/${id}/revisions`);
    },
  },

  readingList: {
    list: async (params?: {
      status?: string;
      page?: number;
      pageSize?: number;
      sort?: string;
    }): Promise<PaginatedResponse<ReadingListItemResponse>> => {
      const query = buildQuery(params);
      return request<PaginatedResponse<ReadingListItemResponse>>(`/api/reading-list${query}`);
    },
    add: async (contentEntryId: string, personalNote?: string): Promise<ApiResponse<ReadingListItemResponse>> => {
      return request<ApiResponse<ReadingListItemResponse>>('/api/reading-list', {
        method: 'POST',
        body: JSON.stringify({ contentEntryId, personalNote }),
      });
    },
    update: async (
      id: string,
      data: {
        status?: 'saved' | 'reading' | 'completed';
        personalNote?: string | null;
      }
    ): Promise<ApiResponse<ReadingListItemResponse>> => {
      return request<ApiResponse<ReadingListItemResponse>>(`/api/reading-list/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    remove: async (id: string): Promise<ApiResponse<{ success: boolean }>> => {
      return request<ApiResponse<{ success: boolean }>>(`/api/reading-list/${id}`, {
        method: 'DELETE',
      });
    },
  },

  workflows: {
    list: async (): Promise<ApiResponse<WorkflowResponse[]>> => {
      return request<ApiResponse<WorkflowResponse[]>>('/api/workflows');
    },
    get: async (slug: string): Promise<ApiResponse<WorkflowResponse>> => {
      return request<ApiResponse<WorkflowResponse>>(`/api/workflows/${slug}`);
    },
    update: async (
      slug: string,
      data: {
        enabled?: boolean;
        scheduleExpression?: string;
        timezone?: string;
        configuration?: Record<string, unknown>;
      }
    ): Promise<ApiResponse<WorkflowResponse>> => {
      return request<ApiResponse<WorkflowResponse>>(`/api/workflows/${slug}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    trigger: async (slug: string): Promise<ApiResponse<WorkflowRunResponse>> => {
      return request<ApiResponse<WorkflowRunResponse>>(`/api/workflows/${slug}/trigger`, {
        method: 'POST',
      });
    },
  },

  workflowRuns: {
    list: async (params?: {
      workflowId?: string;
      workflowSlug?: string;
      status?: string;
      page?: number;
      pageSize?: number;
      startDate?: string;
      endDate?: string;
    }): Promise<PaginatedResponse<WorkflowRunResponse>> => {
      const query = buildQuery(params);
      return request<PaginatedResponse<WorkflowRunResponse>>(`/api/workflow-runs${query}`);
    },
    get: async (id: string): Promise<ApiResponse<WorkflowRunResponse>> => {
      return request<ApiResponse<WorkflowRunResponse>>(`/api/workflow-runs/${id}`);
    },
  },

  settings: {
    get: async (): Promise<ApiResponse<UserSettings>> => {
      return request<ApiResponse<UserSettings>>('/api/settings');
    },
    update: async (data: Partial<UserSettings>): Promise<ApiResponse<UserSettings>> => {
      return request<ApiResponse<UserSettings>>('/api/settings', {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    health: async (): Promise<ApiResponse<{ status: string; mcp: { status: string; serverCount: number } }>> => {
      return request<ApiResponse<{ status: string; mcp: { status: string; serverCount: number } }>>('/api/health');
    },
  },

  export: {
    entry: async (id: string): Promise<void> => {
      return downloadFile(`/api/export/entry/${id}`, `entry-${id}.md`);
    },
    workflow: async (slug: string, format: 'markdown' | 'json' = 'markdown'): Promise<void> => {
      return downloadFile(`/api/export/workflow/${slug}?format=${format}`, `${slug}-export.${format === 'json' ? 'json' : 'zip'}`);
    },
    library: async (): Promise<void> => {
      return downloadFile('/api/export/library', 'learning-hub-library.zip');
    },
    readingList: async (): Promise<void> => {
      return downloadFile('/api/export/reading-list', 'reading-list.md');
    },
  },
};
