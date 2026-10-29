import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  CheckCircle,
  Download,
  ExternalLink,
  History,
  Tag,
  Calendar,
  Clock,
  Edit3,
  Save,
  Check,
} from 'lucide-react';
import type { ContentEntryResponse, ContentRevisionResponse } from '@wonder-bites/shared';
import { api } from '@/lib/api';
import { formatDate, formatDateTime, estimateReadingTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';

// Only allow http/https URLs — blocks file:// and other dangerous schemes
const isSafeHttpUrl = (url: string): boolean => {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

// Extend sanitize schema so math and table classes don't get stripped
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    div: [...(defaultSchema.attributes?.div || []), 'className'],
    span: [...(defaultSchema.attributes?.span || []), 'className', 'style'],
    code: [...(defaultSchema.attributes?.code || []), 'className'],
  },
};

export function EntryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [entry, setEntry] = useState<ContentEntryResponse | null>(null);
  const [revisions, setRevisions] = useState<ContentRevisionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRevisions, setShowRevisions] = useState(false);
  const [personalNote, setPersonalNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchEntry = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.content.get(id);
      setEntry(res.data);
      if (res.data.readingListItem?.personalNote) {
        setPersonalNote(res.data.readingListItem.personalNote);
      }
    } catch (err: unknown) {
      console.error('Failed to load entry:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load content entry.',
      });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  const fetchRevisions = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.content.getRevisions(id);
      if (res.data) setRevisions(res.data);
    } catch (err) {
      console.error('Failed to load revisions:', err);
    }
  }, [id]);

  useEffect(() => {
    fetchEntry();
    fetchRevisions();
  }, [fetchEntry, fetchRevisions]);

  const handleToggleSave = async () => {
    if (!entry) return;
    setActionLoading(true);
    try {
      if (entry.isSaved && entry.readingListItem?.id) {
        await api.readingList.remove(entry.readingListItem.id);
        setEntry({ ...entry, isSaved: false, readingListItem: null });
        toast({ title: 'Removed', description: 'Entry removed from reading list.' });
      } else {
        const res = await api.readingList.add(entry.id);
        setEntry({ ...entry, isSaved: true, readingListItem: res.data });
        toast({ title: 'Saved', description: 'Entry added to your reading list.' });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Action failed',
        description: 'Unable to update reading list.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleRead = async () => {
    if (!entry) return;
    setActionLoading(true);
    try {
      const nextRead = !entry.isRead;
      if (entry.readingListItem?.id) {
        await api.readingList.update(entry.readingListItem.id, {
          status: nextRead ? 'completed' : 'reading',
        });
      }
      setEntry({ ...entry, isRead: nextRead });
      toast({
        title: nextRead ? 'Marked as Completed' : 'Marked as Unread',
        description: nextRead
          ? 'Great job completing this learning bite!'
          : 'Entry moved back to in-progress.',
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Action failed',
        description: 'Could not update read status.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleExport = async () => {
    if (!id) return;
    try {
      await api.export.entry(id);
      toast({ title: 'Exported', description: 'Markdown file downloaded successfully.' });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Export failed',
        description: 'Could not download Markdown.',
      });
    }
  };

  const handleSaveNote = async () => {
    if (!entry?.readingListItem?.id) {
      // First save to reading list if not yet saved
      try {
        setSavingNote(true);
        const res = await api.readingList.add(entry!.id, personalNote);
        setEntry({ ...entry!, isSaved: true, readingListItem: res.data });
        toast({ title: 'Saved', description: 'Saved note to reading list.' });
      } catch {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to save note.' });
      } finally {
        setSavingNote(false);
      }
      return;
    }

    setSavingNote(true);
    try {
      await api.readingList.update(entry.readingListItem.id, {
        personalNote,
      });
      toast({ title: 'Note saved', description: 'Your personal notes have been updated.' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update note.' });
    } finally {
      setSavingNote(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-40 bg-muted rounded" />
        <div className="h-12 w-3/4 bg-muted rounded" />
        <div className="h-64 bg-card rounded-xl border border-border" />
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-bold">Content entry not found</h2>
        <Button asChild className="mt-4">
          <Link to="/library">Back to Library</Link>
        </Button>
      </div>
    );
  }

  const readingTime = entry.estimatedReadingTime || estimateReadingTime(entry.contentMarkdown);

  return (
    <div className="space-y-8 max-w-4xl mx-auto animate-fade-in pb-16">
      {/* Top navigation row */}
      <div className="flex items-center justify-between gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </Button>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="gap-1.5"
            title="Download Markdown"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>

          <Button
            variant={entry.isSaved ? 'secondary' : 'outline'}
            size="sm"
            onClick={handleToggleSave}
            disabled={actionLoading}
            className="gap-1.5"
          >
            {entry.isSaved ? (
              <>
                <BookmarkCheck className="h-4 w-4 text-amber-500" />
                <span>Saved</span>
              </>
            ) : (
              <>
                <Bookmark className="h-4 w-4" />
                <span>Save</span>
              </>
            )}
          </Button>

          <Button
            variant={entry.isRead ? 'secondary' : 'default'}
            size="sm"
            onClick={handleToggleRead}
            disabled={actionLoading}
            className="gap-1.5"
          >
            <CheckCircle className={`h-4 w-4 ${entry.isRead ? 'text-emerald-500' : ''}`} />
            <span>{entry.isRead ? 'Completed' : 'Mark as Read'}</span>
          </Button>
        </div>
      </div>

      {/* Main Entry Header */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="default" className="text-xs">
            {entry.workflow?.name || entry.category}
          </Badge>
          {entry.category && entry.category !== entry.workflow?.name && (
            <Badge variant="outline" className="text-xs">
              {entry.category}
            </Badge>
          )}
          {entry.isRead && (
            <Badge variant="success" className="text-xs">
              Completed
            </Badge>
          )}
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground leading-tight">
          {entry.title}
        </h1>

        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {formatDate(entry.generatedAt || entry.createdAt)}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {readingTime} min read
          </span>
          {entry.revisionNumber > 1 && (
            <span className="flex items-center gap-1.5 text-primary">
              <History className="h-3.5 w-3.5" />
              Rev #{entry.revisionNumber}
            </span>
          )}
        </div>

        {/* Tags */}
        {entry.tags && entry.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2">
            {entry.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground font-mono"
              >
                <Tag className="h-3 w-3" />
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Summary Callout Card */}
      {entry.summary && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5 text-sm text-foreground">
          <span className="font-semibold text-primary block mb-1">Executive Summary</span>
          <p className="text-muted-foreground leading-relaxed">{entry.summary}</p>
        </div>
      )}

      {/* Markdown Content Article */}
      <Card className="border-border/80 bg-card p-6 sm:p-8 shadow-sm">
        <article className="prose-custom">
          <Markdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeSanitize, rehypeKatex]}
          >
            {entry.contentMarkdown}
          </Markdown>
        </article>
      </Card>

      {/* Source URLs Section */}
      {entry.sourceUrls && entry.sourceUrls.length > 0 && (
        <Card className="border-border/80 bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ExternalLink className="h-4 w-4 text-primary" />
              <span>Citations & Verified Sources</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs">
              {entry.sourceUrls
                .filter(isSafeHttpUrl)
                .map((url, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <span className="text-muted-foreground">{idx + 1}.</span>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline truncate"
                    >
                      {url}
                    </a>
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Personal Learning Notes Section */}
      <Card className="border-border/80 bg-card">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Edit3 className="h-4 w-4 text-primary" />
            <span>Personal Study Notes</span>
          </CardTitle>
          <Button
            size="sm"
            onClick={handleSaveNote}
            disabled={savingNote}
            className="h-8 gap-1.5 text-xs"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{savingNote ? 'Saving...' : 'Save Note'}</span>
          </Button>
        </CardHeader>
        <CardContent>
          <textarea
            value={personalNote}
            onChange={(e) => setPersonalNote(e.target.value)}
            placeholder="Capture your takeaways, key formulas, questions, or practice notes here..."
            className="w-full min-h-[100px] rounded-md border border-input bg-background p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
          />
        </CardContent>
      </Card>

      {/* Revision History Collapsible */}
      <Card className="border-border/80 bg-card">
        <CardHeader
          className="cursor-pointer select-none py-4 flex flex-row items-center justify-between"
          onClick={() => setShowRevisions(!showRevisions)}
        >
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <span>Revision History ({revisions.length} recorded)</span>
          </CardTitle>
          <Button variant="ghost" size="sm" className="text-xs">
            {showRevisions ? 'Hide' : 'Show'}
          </Button>
        </CardHeader>

        {showRevisions && (
          <CardContent className="pt-0 divide-y divide-border/60">
            {revisions.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">
                No past revisions exist for this entry.
              </p>
            ) : (
              revisions.map((rev) => (
                <div key={rev.id} className="py-3 text-xs space-y-1">
                  <div className="flex items-center justify-between font-medium">
                    <span>Revision #{rev.revisionNumber}</span>
                    <span className="text-muted-foreground">
                      {formatDateTime(rev.changedAt)}
                    </span>
                  </div>
                  <p className="text-muted-foreground">Source: {rev.changeSource}</p>
                </div>
              ))
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
