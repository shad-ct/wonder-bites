import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Workflow,
  Play,
  Pause,
  Clock,
  Globe,
  CheckCircle2,
  XCircle,
  Activity,
  Layers,
  ArrowRight,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import type { WorkflowResponse } from '@wonder-bites/shared';
import { api } from '@/lib/api';
import { formatDate, formatRelativeTime } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';

export function WorkflowsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [workflows, setWorkflows] = useState<WorkflowResponse[]>([]);
  const [loading, setLoading] = useState(true);

  // Run Confirmation Modal State
  const [triggeringWorkflow, setTriggeringWorkflow] = useState<WorkflowResponse | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);
  const [togglingSlug, setTogglingSlug] = useState<string | null>(null);

  const fetchWorkflows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.workflows.list();
      setWorkflows(res.data || []);
    } catch (err) {
      console.error('Failed to load workflows:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load workflows.',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  const handleToggleEnabled = async (e: React.MouseEvent, wf: WorkflowResponse) => {
    e.stopPropagation();
    setTogglingSlug(wf.slug);
    try {
      const nextState = !wf.enabled;
      await api.workflows.update(wf.slug, { enabled: nextState });
      setWorkflows((prev) =>
        prev.map((item) => (item.slug === wf.slug ? { ...item, enabled: nextState } : item))
      );
      toast({
        title: nextState ? 'Workflow Resumed' : 'Workflow Paused',
        description: `${wf.name} is now ${nextState ? 'active' : 'paused'}.`,
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: 'Could not toggle workflow status.',
      });
    } finally {
      setTogglingSlug(null);
    }
  };

  const handleConfirmTrigger = async () => {
    if (!triggeringWorkflow) return;
    setIsTriggering(true);
    try {
      await api.workflows.trigger(triggeringWorkflow.slug);
      toast({
        title: 'Workflow Triggered',
        description: `Run initiated for ${triggeringWorkflow.name}. Entries will be generated shortly.`,
      });
      setTriggeringWorkflow(null);
      fetchWorkflows();
    } catch (err: unknown) {
      toast({
        variant: 'destructive',
        title: 'Trigger Failed',
        description: err instanceof Error ? err.message : 'Could not start workflow run.',
      });
    } finally {
      setIsTriggering(false);
    }
  };

  const getStatusBadgeVariant = (status?: string | null) => {
    if (!status) return 'outline';
    switch (status.toLowerCase()) {
      case 'succeeded':
        return 'success';
      case 'failed':
        return 'destructive';
      case 'running':
        return 'warning';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <span>Automated Workflows</span>
            <Workflow className="h-6 w-6 text-primary" />
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage, schedule, and execute your daily knowledge pipelines and algorithmic challenges
          </p>
        </div>
      </div>

      {/* Grid of 7 Workflow Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="h-72 rounded-xl bg-card border border-border animate-pulse p-6 space-y-4" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workflows.map((wf) => {
            const isToggling = togglingSlug === wf.slug;
            return (
              <Card
                key={wf.id || wf.slug}
                onClick={() => navigate(`/workflows/${wf.slug}`)}
                className="group cursor-pointer flex flex-col justify-between border-border/80 hover:border-primary/50 transition-all duration-200 hover:shadow-xl bg-card/90 hover:-translate-y-1"
              >
                <CardHeader className="space-y-3 pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge
                      variant={wf.enabled ? 'default' : 'secondary'}
                      className="text-[11px] font-semibold"
                    >
                      {wf.enabled ? 'Active' : 'Paused'}
                    </Badge>
                    {wf.lastRun && (
                      <Badge
                        variant={getStatusBadgeVariant(wf.lastRun.status)}
                        className="text-[10px] capitalize"
                      >
                        Last: {wf.lastRun.status}
                      </Badge>
                    )}
                  </div>

                  <CardTitle className="text-lg font-bold group-hover:text-primary transition-colors">
                    {wf.name}
                  </CardTitle>

                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {wf.description}
                  </p>
                </CardHeader>

                <CardContent className="space-y-4 pt-1">
                  {/* Schedule & Timezone */}
                  <div className="rounded-lg bg-muted/40 p-3 text-xs space-y-1.5 border border-border/50">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-primary" />
                        Schedule:
                      </span>
                      <span className="font-mono text-foreground">{wf.scheduleExpression}</span>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Globe className="h-3.5 w-3.5" />
                        Timezone:
                      </span>
                      <span className="text-foreground">{wf.timezone}</span>
                    </div>
                  </div>

                  {/* Run Metrics Stats */}
                  <div className="grid grid-cols-3 gap-2 text-center pt-1">
                    <div className="rounded-md bg-accent/30 p-2">
                      <div className="text-base font-bold text-foreground">
                        {wf.totalRuns ?? 0}
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase font-medium">Runs</div>
                    </div>
                    <div className="rounded-md bg-emerald-500/10 p-2 text-emerald-500">
                      <div className="text-base font-bold">
                        {wf.successfulRuns ?? 0}
                      </div>
                      <div className="text-[10px] uppercase font-medium">Passed</div>
                    </div>
                    <div className="rounded-md bg-destructive/10 p-2 text-destructive">
                      <div className="text-base font-bold">
                        {wf.failedRuns ?? 0}
                      </div>
                      <div className="text-[10px] uppercase font-medium">Failed</div>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => handleToggleEnabled(e, wf)}
                    disabled={isToggling}
                    className="h-8 text-xs gap-1.5"
                  >
                    {wf.enabled ? (
                      <>
                        <Pause className="h-3.5 w-3.5" />
                        <span>Pause</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5" />
                        <span>Resume</span>
                      </>
                    )}
                  </Button>

                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTriggeringWorkflow(wf);
                    }}
                    className="h-8 text-xs gap-1.5 shadow-sm shadow-primary/20"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>Run Now</span>
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Confirmation Dialog for Run Now */}
      <Dialog
        open={!!triggeringWorkflow}
        onOpenChange={(open) => !open && setTriggeringWorkflow(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <span>Trigger Workflow</span>
            </DialogTitle>
            <DialogDescription className="pt-2 text-sm">
              Are you sure you want to run{' '}
              <strong className="text-foreground">{triggeringWorkflow?.name}</strong> right now?
              This will trigger its agent pipeline and create new entries.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setTriggeringWorkflow(null)}
              disabled={isTriggering}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmTrigger}
              disabled={isTriggering}
              className="gap-2"
            >
              {isTriggering ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                'Confirm & Run'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
