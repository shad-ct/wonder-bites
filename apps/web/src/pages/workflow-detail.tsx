import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Workflow,
  ArrowLeft,
  Play,
  Save,
  Clock,
  Calendar,
  Globe,
  CheckCircle,
  AlertTriangle,
  History,
  BookOpen,
  Download,
  Settings,
  Layers,
  Loader2,
} from 'lucide-react';
import type { WorkflowResponse, ContentEntryResponse, WorkflowRunResponse } from '@wonder-bites/shared';
import { api } from '@/lib/api';
import { formatDate, formatDateTime, formatRelativeTime } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';

export function WorkflowDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [workflow, setWorkflow] = useState<WorkflowResponse | null>(null);
  const [entries, setEntries] = useState<ContentEntryResponse[]>([]);
  const [runs, setRuns] = useState<WorkflowRunResponse[]>([]);
  const [loading, setLoading] = useState(true);

  // Editable settings
  const [schedule, setSchedule] = useState('');
  const [timezone, setTimezone] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [triggering, setTriggering] = useState(false);

  const fetchWorkflowData = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const [wfRes, entriesRes, runsRes] = await Promise.all([
        api.workflows.get(slug),
        api.content.list({ workflow: slug, pageSize: 10 }),
        api.workflowRuns.list({ workflowSlug: slug, pageSize: 10 }),
      ]);

      if (wfRes.data) {
        setWorkflow(wfRes.data);
        setSchedule(wfRes.data.scheduleExpression || '');
        setTimezone(wfRes.data.timezone || 'Asia/Kolkata');
        setEnabled(wfRes.data.enabled);
      }
      setEntries(entriesRes.data || []);
      setRuns(runsRes.data || []);
    } catch (err) {
      console.error('Failed to load workflow details:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load workflow data.',
      });
    } finally {
      setLoading(false);
    }
  }, [slug, toast]);

  useEffect(() => {
    fetchWorkflowData();
  }, [fetchWorkflowData]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug) return;
    setSavingSettings(true);
    try {
      await api.workflows.update(slug, {
        scheduleExpression: schedule,
        timezone,
        enabled,
      });
      toast({
        title: 'Settings Saved',
        description: 'Workflow configuration updated successfully.',
      });
      fetchWorkflowData();
    } catch (err: unknown) {
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: err instanceof Error ? err.message : 'Could not update settings.',
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleTriggerRun = async () => {
    if (!slug) return;
    setTriggering(true);
    try {
      await api.workflows.trigger(slug);
      toast({
        title: 'Run Triggered',
        description: `Successfully initiated execution for ${workflow?.name || slug}.`,
      });
      fetchWorkflowData();
    } catch (err: unknown) {
      toast({
        variant: 'destructive',
        title: 'Run Failed',
        description: err instanceof Error ? err.message : 'Could not trigger workflow.',
      });
    } finally {
      setTriggering(false);
    }
  };

  const handleExport = async (format: 'markdown' | 'json') => {
    if (!slug) return;
    try {
      await api.export.workflow(slug, format);
      toast({
        title: 'Export Started',
        description: `Exporting workflow entries in ${format} format.`,
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Export Failed',
        description: 'Could not export workflow data.',
      });
    }
  };

  const getStatusBadgeVariant = (status: string) => {
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

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-40 bg-muted rounded" />
        <div className="h-24 bg-card rounded-xl border border-border" />
        <div className="h-64 bg-card rounded-xl border border-border" />
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-bold">Workflow not found</h2>
        <Button asChild className="mt-4">
          <Link to="/workflows">Back to Workflows</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in max-w-5xl mx-auto pb-16">
      {/* Top back navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/workflows')}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>All Workflows</span>
        </Button>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('markdown')}
            className="gap-1.5"
          >
            <Download className="h-4 w-4" />
            <span>Export Archive</span>
          </Button>

          <Button
            size="sm"
            onClick={handleTriggerRun}
            disabled={triggering}
            className="gap-1.5 shadow-md shadow-primary/20"
          >
            {triggering ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Running...</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-current" />
                <span>Run Now</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Workflow Header Banner */}
      <Card className="border-border/80 bg-gradient-to-br from-card via-card to-primary/5 p-6 sm:p-8">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={workflow.enabled ? 'default' : 'secondary'}>
              {workflow.enabled ? 'Active Pipeline' : 'Paused'}
            </Badge>
            <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
              {workflow.slug}
            </span>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            {workflow.name}
          </h1>

          <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">
            {workflow.description}
          </p>

          <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-border/60 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-primary" />
              Schedule: <strong className="font-mono text-foreground">{workflow.scheduleExpression}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" />
              Timezone: <span className="text-foreground">{workflow.timezone}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              Total Generated: <span className="text-foreground font-semibold">{entries.length} items</span>
            </span>
          </div>
        </div>
      </Card>

      {/* Tabs: Configuration / Entries / Runs */}
      <Tabs defaultValue="entries" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="entries">Recent Entries</TabsTrigger>
          <TabsTrigger value="history">Run History</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Recent Entries Tab */}
        <TabsContent value="entries" className="space-y-4">
          {entries.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              No content has been generated by this workflow yet. Click "Run Now" to test it!
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {entries.map((entry) => (
                <Link
                  key={entry.id}
                  to={`/library/${entry.id}`}
                  className="group rounded-xl border border-border bg-card p-5 hover:border-primary/50 transition-all hover:shadow-md block space-y-2"
                >
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(entry.generatedAt || entry.createdAt)}
                    </span>
                    {entry.isRead && (
                      <Badge variant="success" className="text-[10px]">Read</Badge>
                    )}
                  </div>
                  <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors line-clamp-1">
                    {entry.title}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {entry.summary}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Run History Tab */}
        <TabsContent value="history">
          <Card className="overflow-hidden border-border/80">
            {runs.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No past executions recorded.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground uppercase border-b border-border">
                    <tr>
                      <th className="p-3">Status</th>
                      <th className="p-3">Started</th>
                      <th className="p-3">Entries Created</th>
                      <th className="p-3">Trigger Source</th>
                      <th className="p-3">Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {runs.map((run) => (
                      <tr key={run.id} className="hover:bg-accent/30 transition-colors">
                        <td className="p-3">
                          <Badge variant={getStatusBadgeVariant(run.status)} className="capitalize text-xs">
                            {run.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {formatDateTime(run.startedAt)}
                        </td>
                        <td className="p-3 text-xs font-semibold text-foreground">
                          +{run.entriesCreated || 0}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground capitalize">
                          {run.triggerSource || 'scheduled'}
                        </td>
                        <td className="p-3 text-xs text-destructive max-w-xs truncate">
                          {run.errorMessage || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card className="border-border/80">
            <CardHeader>
              <CardTitle className="text-lg">Workflow Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveSettings} className="space-y-4 max-w-xl">
                <div className="space-y-2">
                  <Label htmlFor="schedule">Cron Expression</Label>
                  <Input
                    id="schedule"
                    value={schedule}
                    onChange={(e) => setSchedule(e.target.value)}
                    placeholder="e.g. 0 9 * * *"
                    className="font-mono text-sm"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Standard 5-part cron syntax (minute, hour, day, month, day-of-week).
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timezone">Execution Timezone</Label>
                  <Input
                    id="timezone"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    placeholder="Asia/Kolkata"
                    required
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <input
                    type="checkbox"
                    id="enabled-toggle"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <Label htmlFor="enabled-toggle" className="cursor-pointer">
                    Enable automated schedule for this workflow
                  </Label>
                </div>

                <div className="pt-4">
                  <Button type="submit" disabled={savingSettings} className="gap-2">
                    <Save className="h-4 w-4" />
                    <span>{savingSettings ? 'Saving...' : 'Save Configuration'}</span>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
