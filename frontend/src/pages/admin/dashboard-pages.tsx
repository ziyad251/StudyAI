import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  CheckCircle2,
  CircleDot,
  Clock,
  EyeOff,
  Flag,
  GraduationCap,
  Lock,
  MessageSquare,
  MessagesSquare,
  Sparkles,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState, PageHeader, StatCard } from '@/components/common';
import { QuestionsPerDayChart, QuestionsPerSubjectChart } from '@/components/admin/charts';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';

function useStats() {
  return useQuery({
    queryKey: queryKeys.admin.stats,
    queryFn: api.admin.statistics,
    refetchInterval: 60_000,
  });
}

export function AdminDashboardPage() {
  const { data, isPending, isError, error, refetch } = useStats();
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <div className="space-y-8">
      <PageHeader title="Admin dashboard" description="Platform health at a glance." />
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Key metrics">
        <StatCard
          label="Users"
          value={data?.users.total ?? 0}
          hint={`${data?.users.students ?? 0} students · ${data?.users.teachers ?? 0} teachers`}
          icon={Users}
          loading={isPending}
        />
        <StatCard
          label="Questions"
          value={data?.questions.total ?? 0}
          hint={`${data?.answerRate ?? 0}% answered`}
          icon={MessageSquare}
          tone="ai"
          loading={isPending}
        />
        <StatCard
          label="Median first response"
          value={data?.medianFirstResponseHours == null ? '—' : `${data.medianFirstResponseHours}h`}
          icon={Clock}
          tone="success"
          loading={isPending}
        />
        <StatCard
          label="Open reports"
          value={data?.reports.open ?? 0}
          hint="Awaiting moderation"
          icon={Flag}
          tone={data?.reports.open ? 'destructive' : 'primary'}
          loading={isPending}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Questions per day</CardTitle>
            <CardDescription>Last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            {data ? <QuestionsPerDayChart data={data.questionsPerDay} /> : <div className="h-64" />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Needs attention</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              {
                to: '/admin/reports',
                icon: Flag,
                label: 'Open reports',
                value: data?.reports.open ?? 0,
              },
              {
                to: '/admin/moderation?status=FLAGGED',
                icon: EyeOff,
                label: 'Hidden questions',
                value: data?.questions.flagged ?? 0,
              },
              {
                to: '/admin/users?isActive=false',
                icon: Users,
                label: 'Suspended accounts',
                value: data?.users.suspended ?? 0,
              },
            ].map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent"
              >
                <span className="flex items-center gap-2 text-sm">
                  <item.icon className="size-4 text-muted-foreground" aria-hidden /> {item.label}
                </span>
                <span className="flex items-center gap-2 font-semibold tabular-nums">
                  {item.value} <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                </span>
              </Link>
            ))}
            <Button asChild variant="outline" className="w-full">
              <Link to="/admin/analytics">Full analytics</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function AnalyticsPage() {
  const { data, isPending, isError, error, refetch } = useStats();
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  const q = data?.questions;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Platform analytics"
        description="How students are using StudyAI. Aggregates only – no individual activity is shown."
      />
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5" aria-label="Question status">
        <StatCard label="Open" value={q?.open ?? 0} icon={CircleDot} loading={isPending} />
        <StatCard
          label="Answered"
          value={q?.answered ?? 0}
          icon={CheckCircle2}
          tone="success"
          loading={isPending}
        />
        <StatCard label="Closed" value={q?.closed ?? 0} icon={Lock} loading={isPending} />
        <StatCard
          label="Under review"
          value={q?.flagged ?? 0}
          icon={EyeOff}
          tone="destructive"
          loading={isPending}
        />
        <StatCard
          label="AI-classified"
          value={q?.aiClassified ?? 0}
          hint={
            q?.total ? `${Math.round((q.aiClassified / q.total) * 100)}% of questions` : undefined
          }
          icon={Sparkles}
          tone="ai"
          loading={isPending}
        />
      </section>
      <section className="grid gap-4 sm:grid-cols-3" aria-label="Engagement">
        <StatCard
          label="Answers"
          value={data?.answers.total ?? 0}
          hint={`${data?.answers.accepted ?? 0} accepted`}
          icon={MessageSquare}
          loading={isPending}
        />
        <StatCard
          label="Comments"
          value={data?.comments.total ?? 0}
          icon={MessagesSquare}
          loading={isPending}
        />
        <StatCard
          label="Teachers"
          value={data?.users.teachers ?? 0}
          icon={GraduationCap}
          tone="success"
          loading={isPending}
        />
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Questions per day</CardTitle>
            <CardDescription>Last 30 days (UTC)</CardDescription>
          </CardHeader>
          <CardContent>
            {data ? <QuestionsPerDayChart data={data.questionsPerDay} /> : <div className="h-64" />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Questions per subject</CardTitle>
            <CardDescription>Top 10 subjects by volume</CardDescription>
          </CardHeader>
          <CardContent>
            {data ? (
              <QuestionsPerSubjectChart data={data.questionsPerSubject} />
            ) : (
              <div className="h-64" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
