import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  BookOpen,
  BarChart3,
  ClipboardList,
  Flag,
  GraduationCap,
  LayoutDashboard,
  LibraryBig,
  LogOut,
  Menu,
  MessageSquarePlus,
  MessagesSquare,
  Moon,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Logo } from '@/components/common';
import { useAuth } from '@/features/auth/context';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { ROLE_LABELS, initials } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import type { Role } from '@/lib/types';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const NAV: Record<Role, { section: string; items: NavItem[] }[]> = {
  STUDENT: [
    {
      section: 'Learn',
      items: [
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
        { to: '/questions', label: 'Browse questions', icon: Search, end: true },
        { to: '/questions/ask', label: 'Ask a question', icon: MessageSquarePlus },
        { to: '/my-questions', label: 'My questions', icon: ClipboardList },
        { to: '/assistant', label: 'AI assistant', icon: Sparkles },
      ],
    },
  ],
  TEACHER: [
    {
      section: 'Teach',
      items: [
        { to: '/teacher', label: 'Dashboard', icon: LayoutDashboard, end: true },
        { to: '/teacher/questions', label: 'Assigned questions', icon: GraduationCap },
        { to: '/teacher/answers', label: 'My answers', icon: MessagesSquare },
        { to: '/questions', label: 'All questions', icon: Search, end: true },
        { to: '/assistant', label: 'AI assistant', icon: Sparkles },
      ],
    },
  ],
  ADMIN: [
    {
      section: 'Administration',
      items: [
        { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
        { to: '/admin/users', label: 'Users', icon: Users },
        { to: '/admin/subjects', label: 'Subjects', icon: LibraryBig },
        { to: '/admin/moderation', label: 'Moderation', icon: ShieldCheck },
        { to: '/admin/reports', label: 'Reports', icon: Flag },
        { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
      ],
    },
    {
      section: 'Platform',
      items: [{ to: '/questions', label: 'Browse questions', icon: BookOpen, end: true }],
    },
  ],
};

function SidebarNav({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-6" aria-label="Main">
      {NAV[role].map((group) => (
        <div key={group.section}>
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {group.section}
          </p>
          <ul className="space-y-1">
            {group.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-sidebar-foreground hover:bg-accent hover:text-accent-foreground',
                    )
                  }
                >
                  <item.icon className="size-4" aria-hidden />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function NotificationBell() {
  const { data: count = 0 } = useQuery({
    queryKey: queryKeys.notifications.unread,
    queryFn: api.notifications.unreadCount,
    refetchInterval: 60_000,
  });
  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      className="relative"
      aria-label={`Notifications (${count} unread)`}
    >
      <Link to="/notifications">
        <Bell className="size-5" />
        {count > 0 && (
          <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </Link>
    </Button>
  );
}

export function AppShell() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    toast.success('You have been signed out.');
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-svh bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar px-4 py-5 lg:flex">
        <Logo
          className="mb-8 px-2"
          to={
            user.role === 'ADMIN' ? '/admin' : user.role === 'TEACHER' ? '/teacher' : '/dashboard'
          }
        />
        <SidebarNav role={user.role} />
        <div className="mt-auto rounded-xl border bg-card p-3 text-xs text-muted-foreground">
          <p className="flex items-center gap-1.5 font-medium text-foreground">
            <ShieldCheck className="size-3.5 text-success" aria-hidden /> Privacy-first
          </p>
          <p className="mt-1">Your questions are shown to classmates without your identity.</p>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md sm:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="Open navigation"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-5">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <Logo className="mb-8" />
              <SidebarNav role={user.role} onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="lg:hidden">
            <Logo />
          </div>

          <div className="ml-auto flex items-center gap-1">
            {user.role === 'STUDENT' && (
              <Button asChild size="sm" className="mr-2 hidden sm:inline-flex">
                <Link to="/questions/ask">
                  <MessageSquarePlus className="size-4" /> Ask question
                </Link>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </Button>
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="ml-1 gap-2 px-2" aria-label="Account menu">
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                      {initials(user.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden text-left text-sm leading-tight md:block">
                    <span className="block font-medium">{user.fullName}</span>
                    <span className="block text-xs text-muted-foreground">
                      {ROLE_LABELS[user.role]}
                    </span>
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <p className="font-medium">{user.fullName}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile">
                    <UserCog className="size-4" /> Profile & settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleLogout}>
                  <LogOut className="size-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 animate-in fade-in-50 duration-300">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
