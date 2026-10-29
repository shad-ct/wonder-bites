import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { ThemeProvider } from '@/hooks/use-theme';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { MainLayout } from '@/components/layout/main-layout';

import { LoginPage } from '@/pages/login';
import { DashboardPage } from '@/pages/dashboard';
import { LibraryPage } from '@/pages/library';
import { EntryDetailPage } from '@/pages/entry-detail';
import { ReadingListPage } from '@/pages/reading-list';
import { WorkflowsPage } from '@/pages/workflows';
import { WorkflowDetailPage } from '@/pages/workflow-detail';
import { ExecutionHistoryPage } from '@/pages/execution-history';
import { SettingsPage } from '@/pages/settings';

/**
 * Route protection wrapper — no login required; renders the app directly.
 */
function ProtectedLayout() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-sm font-medium text-muted-foreground">Loading Learning Hub...</span>
        </div>
      </div>
    );
  }

  return <MainLayout />;
}

export function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="wonder-bites-theme">
      <AuthProvider>
        <TooltipProvider delayDuration={300}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            {/* Protected Routes */}
            <Route element={<ProtectedLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/library" element={<LibraryPage />} />
              <Route path="/library/:id" element={<EntryDetailPage />} />
              <Route path="/reading-list" element={<ReadingListPage />} />
              <Route path="/workflows" element={<WorkflowsPage />} />
              <Route path="/workflows/:slug" element={<WorkflowDetailPage />} />
              <Route path="/history" element={<ExecutionHistoryPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
