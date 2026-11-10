import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Flag,
  GraduationCap,
  Loader2,
  MoreHorizontal,
  Pencil,
  ThumbsUp,
  Trash2,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { Markdown } from '@/components/markdown';
import { useAuth } from '@/features/auth/context';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/api-client';
import { timeAgo } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import type { Answer, PublicAuthor, Question } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ReportDialog } from './report-dialog';

export function AuthorLine({
  author,
  isOwn,
  createdAt,
}: {
  author: PublicAuthor;
  isOwn: boolean;
  createdAt: string;
}) {
  const teacher = author.role === 'TEACHER';
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span
        className={cn(
          'flex size-7 items-center justify-center rounded-full',
          teacher ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground',
        )}
        aria-hidden
      >
        {teacher ? <GraduationCap className="size-4" /> : <UserRound className="size-4" />}
      </span>
      <span className="font-medium">{isOwn ? 'You' : author.displayName}</span>
      {teacher && (
        <Badge variant="outline" className="border-success/40 text-success">
          Teacher
        </Badge>
      )}
      {author.role === 'ADMIN' && <Badge variant="outline">Moderator</Badge>}
      {author.isQuestionAuthor && <Badge variant="secondary">Asker</Badge>}
      <span className="text-muted-foreground">· {timeAgo(createdAt)}</span>
    </div>
  );
}

export function AnswerItem({ answer, question }: { answer: Answer; question: Question }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(answer.content);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.questions.answers(question.id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.questions.detail(question.id) });
  };

  const useful = useMutation({
    mutationFn: () => api.answers.setUseful(answer.id, !answer.viewerMarkedUseful),
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const accept = useMutation({
    mutationFn: () => api.answers.accept(answer.id),
    onSuccess: () => {
      toast.success('Answer accepted. Thanks for closing the loop!');
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const update = useMutation({
    mutationFn: () => api.answers.update(answer.id, draft),
    onSuccess: () => {
      setEditing(false);
      toast.success('Answer updated.');
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => api.answers.remove(answer.id),
    onSuccess: () => {
      toast.success('Answer deleted.');
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const locked = question.status === 'CLOSED' || question.status === 'FLAGGED';
  const canAccept = question.isOwn && !answer.isAccepted && !locked;
  const canDelete = answer.isOwn || user?.role === 'ADMIN';
  const canReport = !answer.isOwn && user?.role !== 'ADMIN';

  return (
    <article
      className={cn(
        'rounded-xl border bg-card p-5',
        answer.isAccepted && 'border-success/50 ring-1 ring-success/30',
        answer.author.role === 'TEACHER' && !answer.isAccepted && 'border-success/25',
      )}
      aria-label={answer.isAccepted ? 'Accepted answer' : 'Answer'}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <AuthorLine author={answer.author} isOwn={answer.isOwn} createdAt={answer.createdAt} />
        <div className="flex items-center gap-1">
          {answer.isAccepted && (
            <Badge className="gap-1 bg-success text-white">
              <CheckCircle2 className="size-3" aria-hidden /> Accepted
            </Badge>
          )}
          {(answer.isOwn || canDelete || canReport) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8" aria-label="Answer actions">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {answer.isOwn && (
                  <DropdownMenuItem
                    onSelect={() => {
                      setDraft(answer.content);
                      setEditing(true);
                    }}
                  >
                    <Pencil className="size-4" /> Edit
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="size-4" /> Delete
                  </DropdownMenuItem>
                )}
                {canReport && (
                  <DropdownMenuItem onSelect={() => setReportOpen(true)}>
                    <Flag className="size-4" /> Report
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={6}
            aria-label="Edit answer"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={draft.trim().length < 10 || update.isPending}
              onClick={() => update.mutate()}
            >
              {update.isPending && <Loader2 className="size-4 animate-spin" />} Save
            </Button>
          </div>
        </div>
      ) : (
        <Markdown>{answer.content}</Markdown>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          variant={answer.viewerMarkedUseful ? 'secondary' : 'outline'}
          size="sm"
          disabled={answer.isOwn || useful.isPending || (locked && !answer.viewerMarkedUseful)}
          onClick={() => useful.mutate()}
          aria-pressed={answer.viewerMarkedUseful}
        >
          <ThumbsUp className={cn('size-4', answer.viewerMarkedUseful && 'fill-current')} />
          Useful · {answer.usefulCount}
        </Button>
        {canAccept && (
          <Button
            variant="outline"
            size="sm"
            className="border-success/40 text-success hover:bg-success/10 hover:text-success"
            disabled={accept.isPending}
            onClick={() => accept.mutate()}
          >
            <CheckCircle2 className="size-4" /> Accept answer
          </Button>
        )}
      </div>

      <ReportDialog
        targetType="ANSWER"
        targetId={answer.id}
        trigger={null}
        open={reportOpen}
        onOpenChange={setReportOpen}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this answer?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => remove.mutate()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}
