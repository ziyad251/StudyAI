import { useState } from 'react';
import { useNavigate } from 'react-router';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BellOff,
  CheckCheck,
  CheckCircle2,
  Flag,
  GraduationCap,
  MessageSquare,
  MessagesSquare,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState, ErrorState, ListSkeleton, PageHeader, Pagination } from '@/components/common';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/api-client';
import { timeAgo } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import type { Notification } from '@/lib/types';
import { cn } from '@/lib/utils';

const ICONS: Record<Notification['type'], typeof MessageSquare> = {
  NEW_ANSWER: MessageSquare,
  ANSWER_ACCEPTED: CheckCircle2,
  NEW_COMMENT: MessagesSquare,
  NEW_QUESTION_IN_SUBJECT: GraduationCap,
  QUESTION_MODERATED: ShieldAlert,
  REPORT_RESOLVED: Flag,
};

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const params = { page, pageSize: 15, unreadOnly: unreadOnly || undefined };

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.notifications.list(params),
    queryFn: () => api.notifications.list(params),
    placeholderData: keepPreviousData,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
  const markRead = useMutation({ mutationFn: api.notifications.markRead, onSuccess: invalidate });
  const markAll = useMutation({
    mutationFn: api.notifications.markAllRead,
    onSuccess: (res) => {
      toast.success(res.updated ? `Marked ${res.updated} as read.` : 'Nothing to mark.');
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const open = (n: Notification) => {
    if (!n.isRead) markRead.mutate(n.id);
    if (n.questionId) navigate(`/questions/${n.questionId}`);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notifications"
        description="Updates about your questions and answers. Notifications never reveal who acted."
        actions={
          <Button
            variant="outline"
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending || !data?.unreadCount}
          >
            <CheckCheck className="size-4" /> Mark all as read
          </Button>
        }
      />
      <Tabs
        value={unreadOnly ? 'unread' : 'all'}
        onValueChange={(v) => {
          setUnreadOnly(v === 'unread');
          setPage(1);
        }}
        className="mb-4"
      >
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">
            Unread {data?.unreadCount ? `(${data.unreadCount})` : ''}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {isPending ? (
        <ListSkeleton rows={5} />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title={unreadOnly ? 'No unread notifications' : 'No notifications yet'}
          description="We’ll let you know when something happens."
        />
      ) : (
        <>
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {data.items.map((n) => {
              const Icon = ICONS[n.type];
              return (
                <li key={n.id}>
                  <button
                    onClick={() => open(n)}
                    className={cn(
                      'flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-accent/60',
                      !n.isRead && 'bg-primary/5',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full',
                        n.isRead ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary',
                      )}
                    >
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block text-sm', !n.isRead && 'font-semibold')}>
                        {n.title}
                      </span>
                      <span className="block text-sm text-muted-foreground">{n.message}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {timeAgo(n.createdAt)}
                      </span>
                    </span>
                    {!n.isRead && (
                      <span
                        className="mt-2 size-2 shrink-0 rounded-full bg-primary"
                        aria-label="Unread"
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <Pagination
            page={data.pagination.page}
            totalPages={data.pagination.totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
