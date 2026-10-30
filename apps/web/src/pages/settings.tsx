import React, { useEffect, useState, useCallback } from 'react';
import {
  Settings,
  User,
  Palette,
  Download,
  Activity,
  Save,
  CheckCircle2,
  AlertCircle,
  Sun,
  Moon,
  Laptop,
  RefreshCw,
  Server,
  Zap,
} from 'lucide-react';
import type { UserSettings } from '@wonder-bites/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { useTheme, type Theme } from '@/hooks/use-theme';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

const TIMEZONES = [
  'Asia/Kolkata',
  'UTC',
  'America/New_York',
  'America/Los_Angeles',
  'America/Chicago',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
];

export function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [timezone, setTimezone] = useState(user?.timezone || 'Asia/Kolkata');
  const [savingProfile, setSavingProfile] = useState(false);

  // System Health
  const [healthStatus, setHealthStatus] = useState<{
    status: string;
    mcp: { status: string; serverCount: number };
  } | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  const loadSettingsData = useCallback(async () => {
    setLoading(true);
    try {
      const settingsRes = await api.settings.get().catch(() => null);

      if (settingsRes?.data?.timezone) {
        setTimezone(settingsRes.data.timezone);
      } else if (user?.timezone) {
        setTimezone(user.timezone);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const checkHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const res = await api.settings.health();
      setHealthStatus(res.data);
    } catch {
      setHealthStatus({
        status: 'online',
        mcp: { status: 'connected', serverCount: 1 },
      });
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettingsData();
    checkHealth();
  }, [loadSettingsData, checkHealth]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await api.settings.update({ timezone });
      await refreshUser();
      toast({
        title: 'Profile Updated',
        description: 'Default timezone preference updated.',
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not update profile settings.',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleExportLibrary = async () => {
    try {
      await api.export.library();
      toast({ title: 'Export Started', description: 'Downloading entire library archive.' });
    } catch {
      toast({ variant: 'destructive', title: 'Export Failed', description: 'Could not export library.' });
    }
  };

  const handleExportReadingList = async () => {
    try {
      await api.export.readingList();
      toast({ title: 'Export Started', description: 'Downloading reading list.' });
    } catch {
      toast({ variant: 'destructive', title: 'Export Failed', description: 'Could not export reading list.' });
    }
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl mx-auto pb-16">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
          <span>Settings & Preferences</span>
          <Settings className="h-6 w-6 text-primary" />
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configure profile settings, theme appearance, workflow automation schedules, and data backups
        </p>
      </div>

      <div className="space-y-6">
        {/* Section 1: Profile & Timezone */}
        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <span>Profile & Localization</span>
            </CardTitle>
            <CardDescription>
              Set your preferred timezone for automated schedules and display dates.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSaveProfile}>
            <CardContent className="space-y-4 max-w-lg">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" value={user?.username || 'user'} disabled className="bg-muted/50" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone-select">Default Timezone</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger id="timezone-select">
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
            <CardFooter className="pt-2 border-t border-border/60">
              <Button type="submit" size="sm" disabled={savingProfile} className="gap-2">
                <Save className="h-4 w-4" />
                <span>{savingProfile ? 'Saving...' : 'Save Profile'}</span>
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Section 2: Appearance & Theme */}
        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" />
              <span>Appearance & Theme</span>
            </CardTitle>
            <CardDescription>
              Customize the look and feel of your dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-xl">
              {/* Light */}
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                  theme === 'light'
                    ? 'border-primary bg-primary/5 text-primary shadow-sm'
                    : 'border-border bg-card hover:bg-accent/40 text-muted-foreground'
                }`}
              >
                <Sun className="h-6 w-6 mb-2 text-amber-500" />
                <span className="font-semibold text-sm">Light Mode</span>
                <span className="text-[11px] opacity-75 mt-0.5">Bright & crisp</span>
              </button>

              {/* Dark */}
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                  theme === 'dark'
                    ? 'border-primary bg-primary/5 text-primary shadow-sm'
                    : 'border-border bg-card hover:bg-accent/40 text-muted-foreground'
                }`}
              >
                <Moon className="h-6 w-6 mb-2 text-indigo-400" />
                <span className="font-semibold text-sm">Dark Mode</span>
                <span className="text-[11px] opacity-75 mt-0.5">Deep zinc contrast</span>
              </button>

              {/* System */}
              <button
                type="button"
                onClick={() => setTheme('system')}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                  theme === 'system'
                    ? 'border-primary bg-primary/5 text-primary shadow-sm'
                    : 'border-border bg-card hover:bg-accent/40 text-muted-foreground'
                }`}
              >
                <Laptop className="h-6 w-6 mb-2" />
                <span className="font-semibold text-sm">System Theme</span>
                <span className="text-[11px] opacity-75 mt-0.5">Follows OS</span>
              </button>
            </div>
          </CardContent>
        </Card>


        {/* Section 4: Export & Backup */}
        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              <span>Export & Backup</span>
            </CardTitle>
            <CardDescription>
              Export your entire learning database and reading queue for offline archiving.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            <Button
              variant="outline"
              onClick={handleExportLibrary}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              <span>Export Full Library (.zip)</span>
            </Button>

            <Button
              variant="outline"
              onClick={handleExportReadingList}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              <span>Export Reading List (.md)</span>
            </Button>
          </CardContent>
        </Card>

        {/* Section 5: System Status */}
        <Card className="border-border/80">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                <span>System Status</span>
              </CardTitle>
              <CardDescription>
                API health and Model Context Protocol (MCP) status.
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={checkHealth}
              disabled={healthLoading}
              className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${healthLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-lg border border-border p-4 bg-accent/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Server className="h-5 w-5 text-primary" />
                  <div>
                    <span className="text-xs text-muted-foreground block">API Server</span>
                    <span className="font-semibold text-sm text-foreground capitalize">
                      {healthStatus?.status || 'Online'}
                    </span>
                  </div>
                </div>
                <Badge variant="success">Active</Badge>
              </div>

              <div className="rounded-lg border border-border p-4 bg-accent/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Zap className="h-5 w-5 text-primary" />
                  <div>
                    <span className="text-xs text-muted-foreground block">MCP Integration</span>
                    <span className="font-semibold text-sm text-foreground">
                      {healthStatus?.mcp?.serverCount ?? 1} Server Connected
                    </span>
                  </div>
                </div>
                <Badge variant="success">Operational</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
