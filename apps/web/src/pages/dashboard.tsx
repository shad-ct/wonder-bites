import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Eye,
  CheckCircle,
  Bookmark,
  Calendar,
  ArrowRight,
  RefreshCw,
  Clock,
  Sparkles,
} from 'lucide-react';
import type { DashboardSummary } from '@wonder-bites/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { formatDate, formatRelativeTime } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSummary = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await api.dashboard.getSummary();
      setSummary(res.data);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || 'Failed to load dashboard summary');
      } else {
        setError('Failed to load dashboard data');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Greeting based on current time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
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

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header with Greeting & Quick Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <span>{getGreeting()}, {user?.username || 'Learner'}</span>
            <Sparkles className="h-6 w-6 text-primary animate-pulse hidden sm:inline-block" />
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Here is your daily knowledge snapshot and active workflow pipeline.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchSummary(true)}
            disabled={loading || refreshing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
          <Button asChild size="sm" className="gap-2">
            <Link to="/reading-list">
              <Bookmark className="h-4 w-4" />
              <span>Read Later</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* 6 Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Total Entries */}
        <Card className="relative overflow-hidden border-border/80 bg-gradient-to-br from-card via-card to-blue-500/5 hover:border-blue-500/30 transition-all duration-200 hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Entries</CardTitle>
            <div className="h-9 w-9 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <BookOpen className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">
              {loading ? (
                <div className="h-9 w-16 bg-muted animate-pulse rounded" />
              ) : (
                summary?.totalEntries ?? 0
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Across all automated workflows</p>
          </CardContent>
        </Card>

        {/* Unread */}
        <Card className="relative overflow-hidden border-border/80 bg-gradient-to-br from-card via-card to-cyan-500/5 hover:border-cyan-500/30 transition-all duration-200 hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unread</CardTitle>
            <div className="h-9 w-9 rounded-lg bg-cyan-500/10 text-cyan-500 flex items-center justify-center">
              <Eye className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">
              {loading ? (
                <div className="h-9 w-16 bg-muted animate-pulse rounded" />
              ) : (
                summary?.unreadEntries ?? 0
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Waiting for your review</p>
          </CardContent>
        </Card>

        {/* Completed */}
        <Card className="relative overflow-hidden border-border/80 bg-gradient-to-br from-card via-card to-emerald-500/5 hover:border-emerald-500/30 transition-all duration-200 hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <CheckCircle className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">
              {loading ? (
                <div className="h-9 w-16 bg-muted animate-pulse rounded" />
              ) : (
                summary?.completedEntries ?? 0
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Learned and archived</p>
          </CardContent>
        </Card>

        {/* Saved for Later */}
        <Card className="relative overflow-hidden border-border/80 bg-gradient-to-br from-card via-card to-amber-500/5 hover:border-amber-500/30 transition-all duration-200 hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saved for Later</CardTitle>
            <div className="h-9 w-9 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Bookmark className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">
              {loading ? (
                <div className="h-9 w-16 bg-muted animate-pulse rounded" />
              ) : (
                summary?.savedForLater ?? 0
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">In your personal reading list</p>
          </CardContent>
        </Card>

        {/* Today */}
        <Card className="relative overflow-hidden border-border/80 bg-gradient-to-br from-card via-card to-purple-500/5 hover:border-purple-500/30 transition-all duration-200 hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Generated Today</CardTitle>
            <div className="h-9 w-9 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center">
              <Calendar className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">
              {loading ? (
                <div className="h-9 w-16 bg-muted animate-pulse rounded" />
              ) : (
                summary?.todayEntries ?? 0
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Freshly delivered today</p>
          </CardContent>
        </Card>
      </div>

      {/* Two-column layout: Recent Content & Latest Executions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Content */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight text-foreground">Recent Content</h2>
            <Button asChild variant="ghost" size="sm" className="text-xs text-primary gap-1">
              <Link to="/library">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          <Card className="border-border/80 divide-y divide-border/60">
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-16 bg-muted/60 animate-pulse rounded-lg" />
                ))}
              </div>
            ) : summary?.recentContent && summary.recentContent.length > 0 ? (
              summary.recentContent.slice(0, 5).map((entry) => (
                <Link
                  key={entry.id}
                  to={`/library/${entry.id}`}
                  className="group flex flex-col gap-1.5 p-4 hover:bg-accent/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1">
                      {entry.title}
                    </span>
                    <Badge variant="outline" className="text-[10px] shrink-0 font-normal">
                      {entry.workflow?.name || entry.category || 'Content'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {entry.summary}
                  </p>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1">
                    <span>{formatRelativeTime(entry.generatedAt || entry.createdAt)}</span>
                    {entry.estimatedReadingTime && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {entry.estimatedReadingTime} min read
                      </span>
                    )}
                  </div>
                </Link>
              ))
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No content entries yet. Trigger a workflow to get started!
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
