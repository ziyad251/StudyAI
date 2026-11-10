import { useState } from 'react';
import { Link } from 'react-router';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  EyeOff,
  Flag,
  Loader2,
  Lock,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState, ErrorState, ListSkeleton, PageHeader, Pagination } from '@/components/common';
import { StatusBadge } from '@/components/questions/status-badge';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/api-client';
import { REPORT_REASON_LABELS, timeAgo } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import type { AdminReport, ModerationQuestion, QuestionStatus, ReportStatus } from '@/lib/types';

type Action = 'FLAG' | 'RESTORE' | 'CLOSE' | 'DELETE';
const ACTION_LABELS: Record<Action, string> = {
  FLAG: 'Hide question',
  RESTORE: 'Restore question',
  CLOSE: 'Close question',
  DELETE: 'Delete question',
};

function ModerateDialog({
  target,
  onClose,
}: {
  target: { question: ModerationQuestion; action: Action } | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [suspendAuthor, setSuspendAuthor] = useState(false);
  const moderate = useMutation({
    mutationFn: () =>
      api.admin.moderate(target!.question.id, {
        action: target!.action,
        note: note || undefined,
        suspendAuthor,
      }),
    onSuccess: (res) => {
      toast.success(`Done.${res.authorSuspended ? ' The author’s account was suspended.' : ''}`);
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.questions.all });
      setNote('');
      setSuspendAuthor(false);
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (!target) return null;
  const destructive = target.action === 'DELETE' || target.action === 'FLAG';
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{ACTION_LABELS[target.action]}</DialogTitle>
          <DialogDescription className="line-clamp-2">“{target.question.title}”</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mod-note">Note to the author (optional)</Label>
            <Textarea
              id="mod-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={1000}
            />
          </div>
          {target.action !== 'RESTORE' && (
            <div className="flex items-start gap-3 rounded-lg border p-3">
              <Switch id="suspend" checked={suspendAuthor} onCheckedChange={setSuspendAuthor} />
              <Label htmlFor="suspend" className="block font-normal">
                <span className="font-medium">Also suspend the author’s account</span>
                <span className="block text-xs text-muted-foreground">
                  For serious abuse. The author stays anonymous to you – the server applies the
                  suspension internally.
                </span>
              </Label>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={() => moderate.mutate()}
            disabled={moderate.isPending}
          >
            {moderate.isPending && <Loader2 className="size-4 animate-spin" />} Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ModerationPage() {
  const initialStatus = new URLSearchParams(window.location.search).get('status');
  const [tab, setTab] = useState<string>(initialStatus === 'FLAGGED' ? 'FLAGGED' : 'reported');
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<{ question: ModerationQuestion; action: Action } | null>(
    null,
  );

  const params = {
    page,
    pageSize: 10,
    reportedOnly: tab === 'reported' || undefined,
    status: tab === 'reported' || tab === 'all' ? undefined : (tab as QuestionStatus),
  };
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.admin.moderation(params),
    queryFn: () => api.admin.moderationQueue(params),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader title="Question moderation" description="Review reported and hidden questions." />
      <Alert className="mb-4">
        <ShieldCheck className="size-4" />
        <AlertDescription>
          Question authors are never shown here. Moderate the content; the platform handles
          accountability.
        </AlertDescription>
      </Alert>
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v);
          setPage(1);
        }}
        className="mb-4"
      >
        <TabsList>
          <TabsTrigger value="reported">Reported</TabsTrigger>
          <TabsTrigger value="FLAGGED">Hidden</TabsTrigger>
          <TabsTrigger value="all">All questions</TabsTrigger>
        </TabsList>
      </Tabs>
      {isPending ? (
        <ListSkeleton />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Nothing to review"
          description="The community is behaving. 🎉"
        />
      ) : (
        <>
          <ul className="space-y-3">
            {data.items.map((q) => (
              <li key={q.id} className="rounded-xl border bg-card p-5">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="secondary">{q.subject.code}</Badge>
                  <StatusBadge status={q.status} />
                  {q.openReportCount > 0 && (
                    <Badge
                      variant="outline"
                      className="gap-1 border-destructive/40 text-destructive"
                    >
                      <Flag className="size-3" /> {q.openReportCount} open{' '}
                      {q.openReportCount === 1 ? 'report' : 'reports'}
                    </Badge>
                  )}
                  <span className="ml-auto text-muted-foreground">{timeAgo(q.createdAt)}</span>
                </div>
                <Link
                  to={`/questions/${q.id}`}
                  className="mt-2 block font-semibold hover:underline"
                >
                  {q.title}
                </Link>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{q.description}</p>
                {q.moderationNote && (
                  <p className="mt-2 text-xs italic text-muted-foreground">
                    Moderation note: {q.moderationNote}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {q.status === 'FLAGGED' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setTarget({ question: q, action: 'RESTORE' })}
                    >
                      <RotateCcw className="size-4" /> Restore
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setTarget({ question: q, action: 'FLAG' })}
                    >
                      <EyeOff className="size-4" /> Hide
                    </Button>
                  )}
                  {q.status !== 'CLOSED' && q.status !== 'FLAGGED' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setTarget({ question: q, action: 'CLOSE' })}
                    >
                      <Lock className="size-4" /> Close
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setTarget({ question: q, action: 'DELETE' })}
                  >
                    <Trash2 className="size-4" /> Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <Pagination
            page={data.pagination.page}
            totalPages={data.pagination.totalPages}
            onPageChange={setPage}
          />
        </>
      )}
      <ModerateDialog target={target} onClose={() => setTarget(null)} />
    </>
  );
}

function ResolveDialog({ report, onClose }: { report: AdminReport | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [removeContent, setRemoveContent] = useState(true);
  const resolve = useMutation({
    mutationFn: (status: 'RESOLVED' | 'DISMISSED') =>
      api.admin.resolveReport(report!.id, {
        status,
        resolutionNote: note || undefined,
        removeContent: status === 'RESOLVED' && removeContent,
      }),
    onSuccess: () => {
      toast.success('Report handled. The reporter has been notified.');
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
      setNote('');
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (!report) return null;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Review report</DialogTitle>
          <DialogDescription>
            {REPORT_REASON_LABELS[report.reason]} · {report.targetType.toLowerCase()}
            {report.reportCount > 1 ? ` · ${report.reportCount} open reports on this content` : ''}
          </DialogDescription>
        </DialogHeader>
        <blockquote className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg border-l-4 border-destructive/50 bg-muted p-3 text-sm">
          {report.contentSnapshot}
        </blockquote>
        {report.details && (
          <p className="text-sm">
            <span className="font-medium">Reporter’s note:</span> {report.details}
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="res-note">Resolution note (optional)</Label>
          <Textarea
            id="res-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={1000}
          />
        </div>
        {!report.targetRemoved && (
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <Switch id="remove" checked={removeContent} onCheckedChange={setRemoveContent} />
            <Label htmlFor="remove" className="block font-normal">
              <span className="font-medium">
                {report.targetType === 'QUESTION'
                  ? 'Hide the question'
                  : `Delete the ${report.targetType.toLowerCase()}`}
              </span>
              <span className="block text-xs text-muted-foreground">
                Applied when you choose “Take action”. The report is kept for the audit trail.
              </span>
            </Label>
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => resolve.mutate('DISMISSED')}
            disabled={resolve.isPending}
          >
            Dismiss – no violation
          </Button>
          <Button
            variant="destructive"
            onClick={() => resolve.mutate('RESOLVED')}
            disabled={resolve.isPending}
          >
            {resolve.isPending && <Loader2 className="size-4 animate-spin" />} Take action
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ReportsPage() {
  const [status, setStatus] = useState<ReportStatus | 'ALL'>('OPEN');
  const [page, setPage] = useState(1);
  const [reviewing, setReviewing] = useState<AdminReport | null>(null);
  const params = { page, pageSize: 15, status: status === 'ALL' ? undefined : status };
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.admin.reports(params),
    queryFn: () => api.admin.reports(params),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader
        title="Reports"
        description="Content flagged by the community. Reporters and authors stay anonymous."
      />
      <Tabs
        value={status}
        onValueChange={(v) => {
          setStatus(v as ReportStatus | 'ALL');
          setPage(1);
        }}
        className="mb-4"
      >
        <TabsList>
          <TabsTrigger value="OPEN">Open</TabsTrigger>
          <TabsTrigger value="RESOLVED">Resolved</TabsTrigger>
          <TabsTrigger value="DISMISSED">Dismissed</TabsTrigger>
          <TabsTrigger value="ALL">All</TabsTrigger>
        </TabsList>
      </Tabs>
      {isPending ? (
        <ListSkeleton />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title={status === 'OPEN' ? 'No open reports' : 'No reports'}
        />
      ) : (
        <>
          <ul className="space-y-3">
            {data.items.map((r) => (
              <li key={r.id} className="rounded-xl border bg-card p-5">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline">{r.targetType}</Badge>
                  <Badge variant="outline" className="border-destructive/40 text-destructive">
                    {REPORT_REASON_LABELS[r.reason]}
                  </Badge>
                  <Badge variant={r.status === 'OPEN' ? 'default' : 'secondary'}>{r.status}</Badge>
                  {r.targetRemoved && <Badge variant="secondary">Content removed</Badge>}
                  <span className="ml-auto text-muted-foreground">{timeAgo(r.createdAt)}</span>
                </div>
                <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm">{r.contentSnapshot}</p>
                {r.question?.title && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    On question:{' '}
                    <Link
                      to={`/questions/${r.question.id}`}
                      className="text-primary hover:underline"
                    >
                      {r.question.title}
                    </Link>
                  </p>
                )}
                {r.resolutionNote && (
                  <p className="mt-2 text-xs italic text-muted-foreground">
                    Resolution: {r.resolutionNote}
                  </p>
                )}
                {r.status === 'OPEN' && (
                  <Button size="sm" className="mt-4" onClick={() => setReviewing(r)}>
                    Review
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <Pagination
            page={data.pagination.page}
            totalPages={data.pagination.totalPages}
            onPageChange={setPage}
          />
        </>
      )}
      <ResolveDialog report={reviewing} onClose={() => setReviewing(null)} />
    </>
  );
}
