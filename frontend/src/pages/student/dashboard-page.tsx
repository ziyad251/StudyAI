import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  CircleDot,
  ClipboardList,
  MessageSquarePlus,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, ErrorState, ListSkeleton, StatCard } from '@/components/common';
import { QuestionCard } from '@/components/questions/question-card';
import { useAuth } from '@/features/auth/context';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

export function StudentDashboardPage() {
  const { user } = useAuth();
  const stats = useQuery({ queryKey: queryKeys.studentStats, queryFn: api.users.statistics });
  const recentFilters = { mine: true, pageSize: 4, sort: 'newest' as const };
  const recent = useQuery({
    queryKey: queryKeys.questions.list(recentFilters),
    queryFn: () => api.questions.list(recentFilters),
  });
  const notifParams = { pageSize: 5 };
  const notifications = useQuery({
    queryKey: queryKeys.notifications.list(notifParams),
    queryFn: () => api.notifications.list(notifParams),
  });

  const firstName = user?.fullName.split(' ')[0] ?? '';

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-2xl bg-primary p-6 text-primary-foreground sm:p-8">
        <div
          className="absolute -right-16 -top-16 size-64 rounded-full bg-ai/30 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm opacity-80">Welcome back</p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
              Hi {firstName}, what are you curious about today?
            </h1>
            <p className="mt-2 max-w-lg text-sm opacity-90">
              Ask anything – classmates will only ever see “Anonymous student”.
            </p>
          </div>
          <Button asChild size="lg" variant="secondary" className="shrink-0">
            <Link to="/questions/ask">
              <MessageSquarePlus className="size-4" /> Ask a question
            </Link>
          </Button>
        </div>
      </section>

      <section aria-label="Your statistics" className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Questions asked"
          value={stats.data?.totalQuestions ?? 0}
          icon={ClipboardList}
          loading={stats.isPending}
        />
        <StatCard
          label="Answered"
          value={stats.data?.answered ?? 0}
          icon={CheckCircle2}
          tone="success"
          loading={stats.isPending}
        />
        <StatCard
          label="Still open"
          value={stats.data?.open ?? 0}
          icon={CircleDot}
          tone="warning"
          loading={stats.isPending}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section aria-labelledby="recent-heading">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="recent-heading" className="text-lg font-semibold">
              Your recent questions
            </h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/my-questions">
                View all <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
          {recent.isPending ? (
            <ListSkeleton rows={3} />
          ) : recent.isError ? (
            <ErrorState error={recent.error} onRetry={() => recent.refetch()} />
          ) : recent.data.items.length === 0 ? (
            <EmptyState
              icon={MessageSquarePlus}
              title="No questions yet"
              description="Your first question is just a click away – and it’s completely anonymous."
              action={
                <Button asChild>
                  <Link to="/questions/ask">Ask your first question</Link>
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {recent.data.items.map((q) => (
                <QuestionCard key={q.id} question={q} />
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <Card className="gap-3">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="size-4" aria-hidden /> Notifications
              </CardTitle>
              <Button asChild variant="link" size="sm" className="h-auto p-0">
                <Link to="/notifications">See all</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {notifications.isPending ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : !notifications.data?.items.length ? (
                <p className="text-sm text-muted-foreground">You’re all caught up.</p>
              ) : (
                <ul className="space-y-3">
                  {notifications.data.items.map((n) => (
                    <li key={n.id}>
                      <Link
                        to={n.questionId ? `/questions/${n.questionId}` : '/notifications'}
                        className="block rounded-lg p-2 -m-2 hover:bg-accent"
                      >
                        <p className={cn('text-sm', !n.isRead && 'font-semibold')}>
                          {!n.isRead && (
                            <span
                              className="mr-1.5 inline-block size-2 rounded-full bg-primary align-middle"
                              aria-label="Unread"
                            />
                          )}
                          {n.title}
                        </p>
                        <p className="line-clamp-1 text-xs text-muted-foreground">
                          {n.message} · {timeAgo(n.createdAt)}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card className="gap-3 border-ai/30 bg-ai-soft/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="size-4 text-ai" aria-hidden /> Stuck right now?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Get an instant, clearly-labelled AI explanation of any concept.
              </p>
              <Button asChild size="sm" className="mt-3 bg-ai text-white hover:bg-ai/90">
                <Link to="/assistant">Open AI assistant</Link>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
