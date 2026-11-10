import { useState } from 'react';
import { Link } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  CircleDot,
  GraduationCap,
  Inbox,
  MessagesSquare,
  ThumbsUp,
  Trophy,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
  PageHeader,
  Pagination,
  StatCard,
} from '@/components/common';
import { QuestionCard } from '@/components/questions/question-card';
import { StatusBadge } from '@/components/questions/status-badge';
import { useAuth } from '@/features/auth/context';
import { useDebounce } from '@/hooks/use-debounce';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';

export function TeacherDashboardPage() {
  const { user } = useAuth();
  const stats = useQuery({ queryKey: queryKeys.teacher.stats, queryFn: api.teacher.statistics });
  const queueParams = { unanswered: true, pageSize: 5 };
  const queue = useQuery({
    queryKey: queryKeys.teacher.questions(queueParams),
    queryFn: () => api.teacher.questions(queueParams),
  });
  const s = stats.data;

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome, ${user?.fullName ?? ''}`}
        description="Questions from your assigned subjects that are waiting for an expert answer."
        actions={
          <Button asChild>
            <Link to="/teacher/questions?unanswered=true">
              <Inbox className="size-4" /> Answer questions
            </Link>
          </Button>
        }
      />
      <section aria-label="Statistics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Waiting for an answer"
          value={s?.unansweredQuestions ?? 0}
          icon={Inbox}
          tone="warning"
          loading={stats.isPending}
        />
        <StatCard
          label="Open questions"
          value={s?.openQuestions ?? 0}
          icon={CircleDot}
          loading={stats.isPending}
        />
        <StatCard
          label="Your answers"
          value={s?.myAnswers ?? 0}
          icon={MessagesSquare}
          tone="ai"
          loading={stats.isPending}
        />
        <StatCard
          label="Accepted answers"
          value={s?.myAcceptedAnswers ?? 0}
          icon={Trophy}
          tone="success"
          loading={stats.isPending}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section aria-labelledby="queue-heading">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="queue-heading" className="text-lg font-semibold">
              Unanswered in your subjects
            </h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/teacher/questions">
                All questions <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
          {queue.isPending ? (
            <ListSkeleton rows={3} />
          ) : queue.isError ? (
            <ErrorState error={queue.error} onRetry={() => queue.refetch()} />
          ) : queue.data.items.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Inbox zero!"
              description="Every question in your subjects has at least one answer."
            />
          ) : (
            <div className="space-y-3">
              {queue.data.items.map((q) => (
                <QuestionCard key={q.id} question={q} />
              ))}
            </div>
          )}
        </section>

        <Card className="h-fit gap-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="size-4" aria-hidden /> Your subjects
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.isPending ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : !s?.perSubject.length ? (
              <p className="text-sm text-muted-foreground">
                No subjects are assigned to you yet. Ask an administrator to assign your subjects.
              </p>
            ) : (
              s.perSubject.map((subject) => {
                const answeredPct = subject.total
                  ? Math.round((subject.answered / subject.total) * 100)
                  : 0;
                return (
                  <div key={subject.subjectId}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <Link
                        to={`/teacher/questions?subjectId=${subject.subjectId}`}
                        className="font-medium hover:underline"
                      >
                        {subject.code} · {subject.name}
                      </Link>
                      <span className="text-xs text-muted-foreground">{subject.total} total</span>
                    </div>
                    <Progress value={answeredPct} aria-label={`${answeredPct}% answered`} />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {subject.unanswered} unanswered · {answeredPct}% answered
                    </p>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function AssignedQuestionsPage() {
  const initial = new URLSearchParams(window.location.search);
  const [page, setPage] = useState(1);
  const [subjectId, setSubjectId] = useState(initial.get('subjectId') ?? 'all');
  const [status, setStatus] = useState('all');
  const [unanswered, setUnanswered] = useState(initial.get('unanswered') === 'true');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search.trim());

  const subjects = useQuery({
    queryKey: queryKeys.teacher.subjects,
    queryFn: api.teacher.subjects,
  });
  const params = {
    page,
    pageSize: 10,
    subjectId: subjectId === 'all' ? undefined : subjectId,
    status: status === 'all' ? undefined : status,
    unanswered: unanswered || undefined,
    search: debouncedSearch || undefined,
  };
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.teacher.questions(params),
    queryFn: () => api.teacher.questions(params),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader
        title="Assigned questions"
        description="Questions in the subjects you teach. Students are always anonymous."
      />
      <div className="mb-5 grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-[1fr_auto_auto]">
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search…"
          aria-label="Search questions"
        />
        <Select
          value={subjectId}
          onValueChange={(v) => {
            setSubjectId(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full md:w-60" aria-label="Subject">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All my subjects</SelectItem>
            {subjects.data?.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.code} · {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full md:w-36" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="ANSWERED">Answered</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 md:col-span-3">
          <Switch
            id="t-unanswered"
            checked={unanswered}
            onCheckedChange={(c) => {
              setUnanswered(c);
              setPage(1);
            }}
          />
          <Label htmlFor="t-unanswered" className="font-normal text-muted-foreground">
            Only questions without answers
          </Label>
        </div>
      </div>
      {isPending ? (
        <ListSkeleton />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No questions here"
          description={
            subjects.data?.length === 0
              ? 'You have no subjects assigned yet.'
              : 'Nothing matches these filters.'
          }
        />
      ) : (
        <>
          <div className="space-y-3">
            {data.items.map((q) => (
              <QuestionCard key={q.id} question={q} />
            ))}
          </div>
          <Pagination
            page={data.pagination.page}
            totalPages={data.pagination.totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </>
  );
}

export function TeacherAnswersPage() {
  const [page, setPage] = useState(1);
  const params = { page, pageSize: 10 };
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.teacher.answers(params),
    queryFn: () => api.teacher.answers(params),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader
        title="My answers"
        description="Review, edit or follow up on the answers you have posted."
      />
      {isPending ? (
        <ListSkeleton />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title="You haven’t answered anything yet"
          action={
            <Button asChild>
              <Link to="/teacher/questions?unanswered=true">Find questions to answer</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="space-y-3">
            {data.items.map((a) => (
              <Card key={a.id} className="gap-3 py-5">
                <CardContent className="space-y-2 px-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="secondary">{a.question.subject}</Badge>
                    <StatusBadge status={a.question.status} />
                    {a.isAccepted && (
                      <Badge className="gap-1 bg-success text-white">
                        <CheckCircle2 className="size-3" /> Accepted
                      </Badge>
                    )}
                    <span className="ml-auto inline-flex items-center gap-1 text-muted-foreground">
                      <ThumbsUp className="size-3.5" /> {a.usefulCount}
                    </span>
                  </div>
                  <Link
                    to={`/questions/${a.question.id}`}
                    className="block font-semibold hover:underline"
                  >
                    {a.question.title}
                  </Link>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{a.content}</p>
                  <p className="text-xs text-muted-foreground">Answered {timeAgo(a.createdAt)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Pagination
            page={data.pagination.page}
            totalPages={data.pagination.totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </>
  );
}
