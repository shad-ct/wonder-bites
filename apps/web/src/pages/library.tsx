import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  Grid,
  List,
  Clock,
  Calendar,
  Tag,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Bookmark,
  CheckCircle,
} from 'lucide-react';
import type { ContentEntryResponse, WorkflowResponse } from '@wonder-bites/shared';
import { api } from '@/lib/api';
import { formatDate, estimateReadingTime } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function LibraryPage() {
  const navigate = useNavigate();

  const [entries, setEntries] = useState<ContentEntryResponse[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [workflowFilter, setWorkflowFilter] = useState('all');
  const [readFilter, setReadFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Load workflows for filter dropdown
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

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {
        page,
        pageSize,
      };

      if (search.trim()) params.search = search.trim();
      if (workflowFilter !== 'all') params.workflow = workflowFilter;
      if (categoryFilter !== 'all') params.category = categoryFilter;
      if (readFilter === 'read') params.isRead = true;
      if (readFilter === 'unread') params.isRead = false;

      const res = await api.content.list(params);
      setEntries(res.data || []);
      if (res.pagination) {
        setTotalPages(res.pagination.totalPages || 1);
        setTotalCount(res.pagination.total || 0);
      }
    } catch (err) {
      console.error('Failed to load library content:', err);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, workflowFilter, readFilter, categoryFilter]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchEntries();
  };

  const handleClearFilters = () => {
    setSearch('');
    setWorkflowFilter('all');
    setReadFilter('all');
    setCategoryFilter('all');
    setPage(1);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Content Library</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Browse, search, and study your complete collection of learning items ({totalCount} total)
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto border border-border rounded-lg p-1 bg-muted/40">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
            className="h-8 px-2.5"
            aria-label="Grid view"
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
            className="h-8 px-2.5"
            aria-label="List view"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by title, concepts, summary, or tags..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button type="submit">Search</Button>
        </form>

        <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-border/60">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <Filter className="h-3.5 w-3.5" />
            <span>Filters:</span>
          </div>

          {/* Workflow Filter */}
          <div className="w-48">
            <Select
              value={workflowFilter}
              onValueChange={(val) => {
                setWorkflowFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 text-xs">
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

          {/* Read Status Filter */}
          <div className="w-36">
            <Select
              value={readFilter}
              onValueChange={(val) => {
                setReadFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="unread">Unread</SelectItem>
                <SelectItem value="read">Completed / Read</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(search || workflowFilter !== 'all' || readFilter !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Reset Filters
            </Button>
          )}
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-64 rounded-xl bg-card border border-border animate-pulse p-6 space-y-3" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center bg-card/40">
          <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
            <BookOpen className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">No entries found</h3>
          <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-4">
            Try adjusting your search query or clear the active filters.
          </p>
          <Button variant="outline" size="sm" onClick={handleClearFilters}>
            Clear all filters
          </Button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {entries.map((entry) => {
            const readingTime = entry.estimatedReadingTime || estimateReadingTime(entry.contentMarkdown);
            return (
              <Card
                key={entry.id}
                onClick={() => navigate(`/library/${entry.id}`)}
                className="group cursor-pointer flex flex-col justify-between border-border/80 hover:border-primary/50 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 bg-card/90"
              >
                <CardHeader className="space-y-2 pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                      {entry.workflow?.name || entry.category || 'Feed'}
                    </Badge>
                    <div className="flex items-center gap-1.5">
                      {entry.isRead && (
                        <span title="Read">
                          <CheckCircle className="h-4 w-4 text-emerald-500" />
                        </span>
                      )}
                      {entry.isSaved && (
                        <span title="Saved for later">
                          <Bookmark className="h-4 w-4 text-amber-500 fill-amber-500" />
                        </span>
                      )}
                    </div>
                  </div>

                  <CardTitle className="text-base font-bold leading-snug group-hover:text-primary transition-colors line-clamp-2">
                    {entry.title}
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                  <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                    {entry.summary}
                  </p>

                  {/* Tags */}
                  {entry.tags && entry.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {entry.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground font-mono"
                        >
                          <Tag className="h-2.5 w-2.5" />
                          {tag}
                        </span>
                      ))}
                      {entry.tags.length > 3 && (
                        <span className="text-[10px] text-muted-foreground self-center">
                          +{entry.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-border/60 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(entry.generatedAt || entry.createdAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {readingTime} min read
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        /* List Mode */
        <Card className="divide-y divide-border/60 border-border/80">
          {entries.map((entry) => {
            const readingTime = entry.estimatedReadingTime || estimateReadingTime(entry.contentMarkdown);
            return (
              <div
                key={entry.id}
                onClick={() => navigate(`/library/${entry.id}`)}
                className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-accent/40 cursor-pointer transition-colors gap-3"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {entry.workflow?.name || entry.category}
                    </Badge>
                    <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                      {entry.title}
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {entry.summary}
                  </p>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(entry.generatedAt || entry.createdAt)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {readingTime} min
                  </span>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border/80 pt-4">
          <p className="text-xs text-muted-foreground">
            Page <span className="font-semibold text-foreground">{page}</span> of{' '}
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
    </div>
  );
}
