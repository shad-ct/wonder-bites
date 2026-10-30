import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  BookmarkCheck,
  Library,
  Settings,
  LogOut,
  Moon,
  Sun,
  Laptop,
  GraduationCap,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export const NAV_ITEMS = [
  {
    title: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    exact: true,
  },
  {
    title: 'Read Later',
    href: '/reading-list',
    icon: BookmarkCheck,
    exact: false,
  },
  {
    title: 'Library',
    href: '/library',
    icon: Library,
    exact: false,
  },
  {
    title: 'Settings',
    href: '/settings',
    icon: Settings,
    exact: false,
  },
];

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const location = useLocation();

  const isLinkActive = (href: string, exact: boolean) => {
    if (exact) {
      return location.pathname === href;
    }
    return location.pathname.startsWith(href);
  };

  const content = (
    <div className="flex h-full flex-col justify-between p-4">
      {/* Brand & Close button */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <NavLink
            to="/"
            onClick={onMobileClose}
            className="flex items-center gap-3 transition-opacity hover:opacity-85"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-indigo-500 shadow-md shadow-primary/25">
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <span className="font-bold text-base tracking-tight bg-gradient-to-r from-foreground via-foreground to-foreground/80 bg-clip-text">
                Learning Hub
              </span>
              <span className="block text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                Personal Edition
              </span>
            </div>
          </NavLink>

          {onMobileClose && (
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-muted-foreground hover:text-foreground"
              onClick={onMobileClose}
            >
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Navigation list */}
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = isLinkActive(item.href, item.exact);
            const Icon = item.icon;
            return (
              <NavLink
                key={item.href}
                to={item.href}
                onClick={onMobileClose}
                className={cn(
                  'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20 font-semibold'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <Icon
                  className={cn(
                    'h-4 w-4 shrink-0 transition-transform duration-150 group-hover:scale-110',
                    active ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground'
                  )}
                />
                <span>{item.title}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Footer: User profile & Theme switcher */}
      <div className="space-y-3 pt-4 border-t border-border/80">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
            <span>Theme</span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2 gap-1.5 text-xs">
                {theme === 'dark' ? (
                  <>
                    <Moon className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Dark</span>
                  </>
                ) : theme === 'light' ? (
                  <>
                    <Sun className="h-3.5 w-3.5 text-amber-500" />
                    <span>Light</span>
                  </>
                ) : (
                  <>
                    <Laptop className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>System</span>
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTheme('light')}>
                <Sun className="mr-2 h-4 w-4 text-amber-500" /> Light
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('dark')}>
                <Moon className="mr-2 h-4 w-4 text-indigo-400" /> Dark
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('system')}>
                <Laptop className="mr-2 h-4 w-4 text-muted-foreground" /> System
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* User row */}
        <div className="flex items-center justify-between rounded-lg bg-accent/40 p-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold uppercase">
                {user?.username ? user.username.slice(0, 2) : 'LH'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">
                {user?.username || 'User'}
              </p>
              <p className="truncate text-[10px] text-muted-foreground">
                {user?.timezone || 'Asia/Kolkata'}
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => logout()}
            title="Log out"
            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop fixed sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 z-30 border-r border-border bg-card/95 backdrop-blur-md">
        {content}
      </aside>

      {/* Mobile drawer backdrop and panel */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={onMobileClose}
          />
          <aside className="relative flex w-72 max-w-[85vw] flex-col bg-background shadow-2xl">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
