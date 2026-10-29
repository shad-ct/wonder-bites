import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bookmark,
  BookOpen,
  CheckCircle,
  Clock,
  Calendar,
  Trash2,
  Edit2,
  Check,
  X,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import type { ReadingListItemResponse } from '@wonder-bites/shared';
import { api } from '@/lib/api';
import { formatDate, estimateReadingTime } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

export function ReadingListPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [items, setItems] = useState<ReadingListItemResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState<'all' | 'saved' | 'reading' | 'completed'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');

  // Inline note editing state { [id: string]: string }
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {
        pageSize: 100,
        sort: sortBy,
      };
      if (currentTab !== 'all') {
        params.status = currentTab;
      }
      const res = await api.readingList.list(params);
      setItems(res.data || []);
    } catch (err) {
      console.error('Failed to load reading list:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load reading list.',
      });
    } finally {
      setLoading(false);
    }
  }, [currentTab, sortBy, toast]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleStatusChange = async (id: string, newStatus: 'saved' | 'reading' | 'completed') => {
    setUpdatingId(id);
    try {
      await api.readingList.update(id, { status: newStatus });
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
      );
      toast({
        title: 'Status updated',
        description: `Marked as ${newStatus}.`,
      });
      if (currentTab !== 'all' && currentTab !== newStatus) {
        setItems((prev) => prev.filter((i) => i.id !== id));
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: 'Could not change item status.',
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm('Remove this item from your reading list?')) return;
    try {
      await api.readingList.remove(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      toast({
        title: 'Removed',
        description: 'Item removed from your reading list.',
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to remove item.',
      });
    }
  };

  const handleStartEditNote = (item: ReadingListItemResponse) => {
    setEditingNoteId(item.id);
    setNoteDraft(item.personalNote || '');
  };

  const handleSaveNote = async (id: string) => {
    try {
      await api.readingList.update(id, { personalNote: noteDraft });
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, personalNote: noteDraft } : item))
      );
      setEditingNoteId(null);
      toast({ title: 'Note saved' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save note.' });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="success">Completed</Badge>;
      case 'reading':
        return <Badge variant="default" className="bg-sky-500 hover:bg-sky-600">Reading</Badge>;
      default:
        return <Badge variant="warning">Saved</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <span>Read Later Queue</span>
            <Bookmark className="h-6 w-6 text-amber-500 fill-amber-500" />
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Your personal saved queue for focused learning, reflection, and notes
          </p>
        </div>

        <Button asChild size="sm" variant="outline" className="gap-2">
          <Link to="/library">
            <BookOpen className="h-4 w-4" />
            <span>Browse Library</span>
          </Link>
        </Button>
      </div>

      {/* Tabs and Sort controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <Tabs
          value={currentTab}
          onValueChange={(val) => setCurrentTab(val as typeof currentTab)}
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="saved">Saved</TabsTrigger>
            <TabsTrigger value="reading">In Progress</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <span className="text-xs text-muted-foreground font-medium">Sort:</span>
          <div className="w-40">
            <Select
              value={sortBy}
              onValueChange={(val) => setSortBy(val as 'newest' | 'oldest')}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Recently Saved</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Item List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 rounded-xl bg-card border border-border animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center bg-card/40">
          <div className="h-12 w-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mb-3">
            <Sparkles className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">
            {currentTab === 'all'
              ? 'Your reading list is empty'
              : `No items in "${currentTab}"`}
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-4">
            Save interesting bites from the content library to read and take notes at your own pace.
          </p>
          <Button asChild size="sm">
            <Link to="/library">Explore Content Library</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const entry = item.contentEntry;
            if (!entry) return null;
            const readingTime = entry.estimatedReadingTime || estimateReadingTime(entry.contentMarkdown);
            const isEditing = editingNoteId === item.id;

            return (
              <Card
                key={item.id}
                className="border-border/80 bg-card hover:border-primary/40 transition-all duration-200 shadow-sm"
              >
                <div className="p-5 sm:p-6 space-y-4">
                  {/* Top row: Badges, Title, Remove button */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {getStatusBadge(item.status)}
                        <Badge variant="outline" className="text-[10px]">
                          {entry.workflow?.name || entry.category}
                        </Badge>
                      </div>

                      <Link
                        to={`/library/${entry.id}`}
                        className="text-lg font-bold text-foreground hover:text-primary transition-colors block line-clamp-1"
                      >
                        {entry.title}
                      </Link>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemove(item.id)}
                      className="text-muted-foreground hover:text-destructive shrink-0 h-8 w-8"
                      title="Remove from reading list"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Summary preview */}
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {entry.summary}
                  </p>

                  {/* Inline Personal Note */}
                  <div className="rounded-lg bg-muted/40 p-3 text-xs space-y-2 border border-border/50">
                    <div className="flex items-center justify-between font-medium text-foreground">
                      <span>Personal Notes</span>
                      {!isEditing && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleStartEditNote(item)}
                          className="h-6 px-2 text-[11px] gap-1 text-primary hover:text-primary"
                        >
                          <Edit2 className="h-3 w-3" />
                          <span>{item.personalNote ? 'Edit' : 'Add note'}</span>
                        </Button>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="space-y-2 pt-1">
                        <textarea
                          value={noteDraft}
                          onChange={(e) => setNoteDraft(e.target.value)}
                          placeholder="Write key takeaways or thoughts..."
                          className="w-full min-h-[60px] rounded border border-input bg-background p-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          autoFocus
                        />
                        <div className="flex justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingNoteId(null)}
                            className="h-6 px-2 text-xs"
                          >
                            <X className="h-3 w-3 mr-1" /> Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleSaveNote(item.id)}
                            className="h-6 px-2 text-xs"
                          >
                            <Check className="h-3 w-3 mr-1" /> Save
                          </Button>
                        </div>
                      </div>
                    ) : item.personalNote ? (
                      <p className="text-muted-foreground italic">{item.personalNote}</p>
                    ) : (
                      <p className="text-muted-foreground/60 italic">No notes yet.</p>
                    )}
                  </div>

                  {/* Bottom bar: Dates, reading time, status transition buttons */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border/60 text-xs text-muted-foreground">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Saved {formatDate(item.savedAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {readingTime} min
                      </span>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {item.status === 'saved' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusChange(item.id, 'reading')}
                          disabled={updatingId === item.id}
                          className="h-7 text-xs"
                        >
                          Start Reading
                        </Button>
                      )}
                      {item.status === 'reading' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusChange(item.id, 'completed')}
                          disabled={updatingId === item.id}
                          className="h-7 text-xs gap-1 text-emerald-500 hover:text-emerald-600"
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          Mark Completed
                        </Button>
                      )}
                      {item.status === 'completed' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleStatusChange(item.id, 'reading')}
                          disabled={updatingId === item.id}
                          className="h-7 text-xs text-muted-foreground"
                        >
                          Read Again
                        </Button>
                      )}

                      <Button
                        size="sm"
                        asChild
                        className="h-7 text-xs gap-1"
                      >
                        <Link to={`/library/${entry.id}`}>
                          Read Now
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
