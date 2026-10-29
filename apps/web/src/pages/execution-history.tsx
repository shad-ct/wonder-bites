import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  History,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Clock,
  Terminal,
  Activity,
  Calendar,
} from 'lucide-react';
import type { WorkflowRunResponse, WorkflowResponse } from '@wonder-bites/shared';
import { api } from '@/lib/api';
import { formatDateTime, formatRelativeTime } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

export function ExecutionHistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStatus = searchParams.get('status') || 'all';

  const [runs, setRuns] = useState<WorkflowRunResponse[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowResponse[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedWorkflow, setSelectedWorkflow] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState(initialStatus);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRuns, setTotalRuns] = useState(0);

  // Selected Run modal
  const [activeRun, setActiveRun] = useState<WorkflowRunResponse | null>(null);

  useEffect(() => {
    async function loadWorkflows() {
      try {
        const res = await api.workflows.list();
        if (res.data) setWorkflows(res.data);
      } catch (err) {
        console.error('Failed to load workflows:', err);
      }
    }
    loadWorkflows();
  }, []);

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {
        page,
        pageSize,
      };
      if (selectedWorkflow !== 'all') params.workflowSlug = selectedWorkflow;
      if (selectedStatus !== 'all') params.status = selectedStatus;

      const res = await api.workflowRuns.list(params);
      setRuns(res.data || []);
      if (res.pagination) {
        setTotalPages(res.pagination.totalPages || 1);
        setTotalRuns(res.pagination.total || 0);
      }
    } catch (err) {
      console.error('Failed to load workflow runs:', err);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, selectedWorkflow, selectedStatus]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  const handleClearFilters = () => {
    setSelectedWorkflow('all');
    setSelectedStatus('all');
    setSearchParams({});
    setPage(1);
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'succeeded':
        return <Badge variant="success">Succeeded</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'running':
        return <Badge variant="warning">Running</Badge>;
      case 'queued':
        return <Badge variant="secondary">Queued</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <span>Execution History</span>
            <History className="h-6 w-6 text-primary" />
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Audit logs and execution telemetry for all automated workflow runs ({totalRuns} total)
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchRuns()}
          disabled={loading}
          className="gap-2 self-start sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Filter Toolbar */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
          <Filter className="h-4 w-4" />
          <span>Filters:</span>
        </div>

        {/* Workflow select */}
        <div className="w-52">
          <Select
            value={selectedWorkflow}
            onValueChange={(val) => {
              setSelectedWorkflow(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="All Workflows" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Workflows</SelectItem>
              {workflows.map((wf) => (
                <SelectItem key={wf.id} value={wf.slug}>
                  {wf.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status select */}
        <div className="w-40">
          <Select
            value={selectedStatus}
            onValueChange={(val) => {
              setSelectedStatus(val);
              setSearchParams(val !== 'all' ? { status: val } : {});
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="succeeded">Succeeded</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="queued">Queued</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(selectedWorkflow !== 'all' || selectedStatus !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="text-xs text-muted-foreground hover:text-foreground h-9"
          >
            Reset
          </Button>
        )}
      </div>

      {/* Runs Table */}
      <Card className="border-border/80 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-muted/60 animate-pulse rounded" />
            ))}
          </div>
        ) : runs.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            No execution history matching the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground uppercase border-b border-border">
                <tr>
                  <th className="p-3.5">Workflow</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Started</th>
                  <th className="p-3.5">Completed</th>
                  <th className="p-3.5">Entries Created</th>
                  <th className="p-3.5">Trigger</th>
                  <th className="p-3.5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {runs.map((run) => (
                  <tr
                    key={run.id}
                    onClick={() => setActiveRun(run)}
                    className="hover:bg-accent/40 cursor-pointer transition-colors"
                  >
                    <td className="p-3.5 font-semibold text-foreground text-xs">
                      {run.workflow?.name || run.workflowId}
                    </td>
                    <td className="p-3.5">
                      {getStatusBadge(run.status)}
                    </td>
                    <td className="p-3.5 text-xs text-muted-foreground">
                      {formatDateTime(run.startedAt)}
                    </td>
                    <td className="p-3.5 text-xs text-muted-foreground">
                      {run.completedAt ? formatDateTime(run.completedAt) : '—'}
                    </td>
                    <td className="p-3.5 text-xs font-semibold text-foreground">
                      +{run.entriesCreated || 0}
                    </td>
                    <td className="p-3.5 text-xs text-muted-foreground capitalize">
                      {run.triggerSource || 'scheduled'}
                    </td>
                    <td className="p-3.5 text-right text-xs text-primary font-medium">
                      Inspect
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border/80 pt-4">
          <p className="text-xs text-muted-foreground">
            Showing page <span className="font-semibold text-foreground">{page}</span> of{' '}
            <span className="font-semibold text-foreground">{totalPages}</span>
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="gap-1 text-xs"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="gap-1 text-xs"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Run Details Modal */}
      <Dialog open={!!activeRun} onOpenChange={(open) => !open && setActiveRun(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <span>Execution Details</span>
            </DialogTitle>
            <DialogDescription>
              Telemetry for run {activeRun?.id}
            </DialogDescription>
          </DialogHeader>

          {activeRun && (
            <div className="space-y-4 pt-2 text-sm">
              <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/40 p-4 border border-border">
                <div>
                  <span className="text-xs text-muted-foreground block">Workflow</span>
                  <span className="font-semibold text-foreground">
                    {activeRun.workflow?.name || activeRun.workflowId}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Status</span>
                  <span className="mt-0.5 inline-block">{getStatusBadge(activeRun.status)}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Started At</span>
                  <span className="text-foreground">{formatDateTime(activeRun.startedAt)}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Completed At</span>
                  <span className="text-foreground">
                    {activeRun.completedAt ? formatDateTime(activeRun.completedAt) : 'Still running / Incomplete'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Trigger Source</span>
                  <span className="text-foreground capitalize">{activeRun.triggerSource}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Entries Created</span>
                  <span className="text-foreground font-semibold">+{activeRun.entriesCreated}</span>
                </div>
              </div>

              {activeRun.errorMessage && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4" />
                    <span>Error Code: {activeRun.errorCode || 'UNKNOWN'}</span>
                  </div>
                  <pre className="font-mono whitespace-pre-wrap">{activeRun.errorMessage}</pre>
                </div>
              )}

              {activeRun.metadata && Object.keys(activeRun.metadata).length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-muted-foreground">Run Metadata & Parameters</span>
                  <pre className="rounded-lg bg-muted p-3 text-xs font-mono overflow-x-auto text-foreground">
                    {JSON.stringify(activeRun.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
