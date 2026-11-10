import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { MessageSquarePlus, SearchX, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { EmptyState, ErrorState, ListSkeleton, Pagination } from '@/components/common';
import { useDebounce } from '@/hooks/use-debounce';
import { useSubjects } from '@/hooks/use-subjects';
import { api, type QuestionFilters } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import type { QuestionStatus } from '@/lib/types';
import { QuestionCard } from './question-card';

const ALL = 'all';

export function QuestionBrowser({
  mine = false,
  showAskCta = false,
}: {
  mine?: boolean;
  showAskCta?: boolean;
}) {
  const [params, setParams] = useSearchParams();
  const { data: subjects = [] } = useSubjects();
  const [searchInput, setSearchInput] = useState(params.get('search') ?? '');
  const search = useDebounce(searchInput.trim());

  const update = (changes: Record<string, string | null>) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(changes)) {
          if (value === null || value === '' || value === ALL) next.delete(key);
          else next.set(key, value);
        }
        if (!('page' in changes)) next.delete('page');
        return next;
      },
      { replace: true },
    );
  };

  useEffect(() => {
    setParams(
      (prev) => {
        if ((prev.get('search') ?? '') === search) return prev;
        const next = new URLSearchParams(prev);
        if (search) next.set('search', search);
        else next.delete('search');
        next.delete('page');
        return next;
      },
      { replace: true },
    );
  }, [search, setParams]);

  const filters: QuestionFilters = {
    page: Number(params.get('page') ?? 1),
    pageSize: 10,
    search: params.get('search') ?? undefined,
    subjectId: params.get('subjectId') ?? undefined,
    status: (params.get('status') as QuestionStatus | null) ?? undefined,
    sort: (params.get('sort') as QuestionFilters['sort']) ?? 'newest',
    unanswered: params.get('unanswered') === 'true' || undefined,
    mine: mine || undefined,
  };

  const { data, isPending, isError, error, refetch, isPlaceholderData } = useQuery({
    queryKey: queryKeys.questions.list(filters),
    queryFn: () => api.questions.list(filters),
    placeholderData: keepPreviousData,
  });

  const hasFilters = Boolean(
    filters.search || filters.subjectId || filters.status || filters.unanswered,
  );

  return (
    <div>
      <div className="mb-5 grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-[1fr_auto_auto_auto]">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search questions…"
            className="pl-9"
            aria-label="Search questions"
          />
        </div>
        <Select value={filters.subjectId ?? ALL} onValueChange={(v) => update({ subjectId: v })}>
          <SelectTrigger className="w-full md:w-52" aria-label="Filter by subject">
            <SelectValue placeholder="All subjects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All subjects</SelectItem>
            {subjects.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.code} · {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.status ?? ALL} onValueChange={(v) => update({ status: v })}>
          <SelectTrigger className="w-full md:w-36" aria-label="Filter by status">
            <SelectValue placeholder="Any status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any status</SelectItem>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="ANSWERED">Answered</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
            {mine && <SelectItem value="FLAGGED">Under review</SelectItem>}
          </SelectContent>
        </Select>
        <Select
          value={filters.sort}
          onValueChange={(v) => update({ sort: v === 'newest' ? null : v })}
        >
          <SelectTrigger className="w-full md:w-40" aria-label="Sort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="most_answered">Most answered</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 md:col-span-4">
          <Switch
            id="unanswered"
            checked={Boolean(filters.unanswered)}
            onCheckedChange={(checked) => update({ unanswered: checked ? 'true' : null })}
          />
          <Label htmlFor="unanswered" className="text-sm font-normal text-muted-foreground">
            Only questions without answers
          </Label>
          {data && (
            <span className="ml-auto text-sm text-muted-foreground" aria-live="polite">
              {data.pagination.total} {data.pagination.total === 1 ? 'question' : 'questions'}
            </span>
          )}
        </div>
      </div>

      {isPending ? (
        <ListSkeleton />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : data.items.length === 0 ? (
        hasFilters ? (
          <EmptyState
            icon={SearchX}
            title="No matching questions"
            description="Try a different search term or clear the filters."
          />
        ) : (
          <EmptyState
            icon={MessageSquarePlus}
            title={mine ? 'You haven’t asked anything yet' : 'No questions yet'}
            description={
              mine
                ? 'Your questions will appear here – only you can see that they’re yours.'
                : 'Be the first to ask!'
            }
            action={
              showAskCta && (
                <Button asChild>
                  <Link to="/questions/ask">Ask a question</Link>
                </Button>
              )
            }
          />
        )
      ) : (
        <div className={isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}>
          <div className="space-y-3">
            {data.items.map((q) => (
              <QuestionCard key={q.id} question={q} />
            ))}
          </div>
          <Pagination
            page={data.pagination.page}
            totalPages={data.pagination.totalPages}
            onPageChange={(page) => update({ page: String(page) })}
          />
        </div>
      )}
    </div>
  );
}
