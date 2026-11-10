import { Link, Outlet } from 'react-router';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/common';
import { useAuth, homePathFor } from '@/features/auth/context';
import { useTheme } from '@/hooks/use-theme';

export function PublicLayout() {
  const { user } = useAuth();
  const { theme, toggle } = useTheme();

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Logo />
          <nav className="ml-auto flex items-center gap-1 sm:gap-2" aria-label="Site">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </Button>
            {user ? (
              <Button asChild>
                <Link to={homePathFor(user.role)}>Go to dashboard</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost">
                  <Link to="/login">Sign in</Link>
                </Button>
                <Button asChild>
                  <Link to="/register">Get started</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} StudyAI. Built for curious students.</p>
          <p>Anonymous to classmates · Accountable to moderators</p>
        </div>
      </footer>
    </div>
  );
}
