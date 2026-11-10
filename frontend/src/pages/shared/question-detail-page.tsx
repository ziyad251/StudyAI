import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  EyeOff,
  Loader2,
  Lock,
  MessageSquare,
  MoreVertical,
  Pencil,
  Sparkles,
  Trash2,
  Unlock,
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState, ErrorState } from '@/components/common';
import { Markdown } from '@/components/markdown';
import { AiExplanationPanel } from '@/components/questions/ai-explanation-panel';
import { AnswerItem } from '@/components/questions/answer-item';
import { CommentsSection } from '@/components/questions/comments-section';
import { ReportDialog } from '@/components/questions/report-dialog';
import { StatusBadge } from '@/components/questions/status-badge';
import { useAuth } from '@/features/auth/context';
import { useAiStatus } from '@/hooks/use-subjects';
import { api } from '@/lib/api';
import { ApiError, errorMessage } from '@/lib/api-client';
import { formatDateTime, pluralize, timeAgo } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import type { Question } from '@/lib/types';

function EditQuestionDialog({
  question,
  open,
  onOpenChange,
}: {
  question: Question;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(question.title);
  const [description, setDescription] = useState(question.description);
  const [piiWarning, setPiiWarning] = useState(false);

  const save = useMutation({
    mutationFn: (acknowledgePersonalInfo: boolean) =>
      api.questions.update(question.id, { title, description, acknowledgePersonalInfo }),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.questions.detail(question.id), updated);
      queryClient.invalidateQueries({ queryKey: queryKeys.questions.all });
      toast.success('Question updated.');
      setPiiWarning(false);
      onOpenChange(false);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'PERSONAL_INFO_WARNING') {
        setPiiWarning(true);
        return;
      }
      toast.error(errorMessage(error));
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit question</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-title">Title</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-description">Details</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={8}
              maxLength={5000}
            />
          </div>
          {piiWarning && (
            <Alert variant="destructive">
              <AlertTitle>Possible personal information</AlertTitle>
              <AlertDescription>
                Your edit may contain identifying details. Remove them, or save anyway if you’re
                sure.
              </AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {piiWarning && (
            <Button variant="outline" onClick={() => save.mutate(true)} disabled={save.isPending}>
              Save anyway
            </Button>
          )}
          <Button
            onClick={() => save.mutate(false)}
            disabled={save.isPending || title.trim().length < 10 || description.trim().length < 20}
          >
            {save.isPending && <Loader2 className="size-4 animate-spin" />} Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AnswerComposer({ question }: { question: Question }) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const add = useMutation({
    mutationFn: () => api.questions.addAnswer(question.id, content.trim()),
    onSuccess: () => {
      setContent('');
      queryClient.invalidateQueries({ queryKey: queryKeys.questions.answers(question.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.questions.detail(question.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.teacher.all });
      toast.success('Answer posted.');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <form
      className="rounded-xl border bg-card p-5"
      onSubmit={(e) => {
        e.preventDefault();
        add.mutate();
      }}
    >
      <Label htmlFor="answer" className="mb-2 block text-base font-semibold">
        Your answer
      </Label>
      <Textarea
        id="answer"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={6}
        placeholder="Explain clearly and step by step. Markdown and code blocks are supported."
        maxLength={10_000}
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Be kind and constructive – there are no silly questions.
        </p>
        <Button type="submit" disabled={content.trim().length < 10 || add.isPending}>
          {add.isPending && <Loader2 className="size-4 animate-spin" />} Post answer
        </Button>
      </div>
    </form>
  );
}

export function QuestionDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: aiStatus } = useAiStatus();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const questionQuery = useQuery({
    queryKey: queryKeys.questions.detail(id),
    queryFn: () => api.questions.get(id),
    retry: false,
  });
  const answersQuery = useQuery({
    queryKey: queryKeys.questions.answers(id),
    queryFn: () => api.questions.answers(id),
    enabled: questionQuery.isSuccess,
  });

  const setStatus = useMutation({
    mutationFn: (status: 'OPEN' | 'CLOSED') => api.questions.update(id, { status }),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.questions.detail(id), updated);
      queryClient.invalidateQueries({ queryKey: queryKeys.questions.all });
      toast.success(updated.status === 'CLOSED' ? 'Question closed.' : 'Question reopened.');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => api.questions.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.questions.all });
      toast.success('Question deleted.');
      navigate(user?.role === 'ADMIN' ? '/admin/moderation' : '/my-questions');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (questionQuery.isPending) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  if (questionQuery.isError) {
    const notFound = questionQuery.error instanceof ApiError && questionQuery.error.status === 404;
    return notFound ? (
      <EmptyState
        icon={EyeOff}
        title="Question not found"
        description="It may have been removed, or it is hidden while a moderator reviews it."
        action={
          <Button asChild variant="outline">
            <Link to="/questions">Browse questions</Link>
          </Button>
        }
      />
    ) : (
      <ErrorState error={questionQuery.error} onRetry={() => questionQuery.refetch()} />
    );
  }

  const question = questionQuery.data;
  const answers = answersQuery.data ?? [];
  const locked = question.status === 'CLOSED' || question.status === 'FLAGGED';
  const canAnswer = (user?.role === 'STUDENT' || user?.role === 'TEACHER') && !locked;
  const canDelete = (question.isOwn && question.answerCount === 0) || user?.role === 'ADMIN';

  return (
    <div className="mx-auto max-w-4xl">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 mb-4 text-muted-foreground"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft className="size-4" /> Back
      </Button>

      {question.status === 'FLAGGED' && (
        <Alert variant="destructive" className="mb-4">
          <EyeOff className="size-4" />
          <AlertTitle>Hidden while under review</AlertTitle>
          <AlertDescription>
            This question was reported and is not visible to other students until a moderator
            reviews it.
          </AlertDescription>
        </Alert>
      )}

      <article className="rounded-2xl border bg-card p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="secondary">
            {question.subject.code} · {question.subject.name}
          </Badge>
          <Badge variant="outline" className="gap-1 border-ai/30 text-ai">
            <Sparkles className="size-3" aria-hidden /> {question.category}
          </Badge>
          <StatusBadge status={question.status} />
          <div className="ml-auto flex items-center gap-1">
            {!question.isOwn && user?.role !== 'ADMIN' && (
              <ReportDialog targetType="QUESTION" targetId={question.id} />
            )}
            {(question.isOwn || user?.role === 'ADMIN') && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label="Question actions"
                  >
                    <MoreVertical className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {question.isOwn && question.status !== 'FLAGGED' && (
                    <>
                      {question.status !== 'CLOSED' && (
                        <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                          <Pencil className="size-4" /> Edit
                        </DropdownMenuItem>
                      )}
                      {question.status === 'CLOSED' ? (
                        <DropdownMenuItem onSelect={() => setStatus.mutate('OPEN')}>
                          <Unlock className="size-4" /> Reopen
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onSelect={() => setStatus.mutate('CLOSED')}>
                          <Lock className="size-4" /> Close question
                        </DropdownMenuItem>
                      )}
                    </>
                  )}
                  {canDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => setDeleteOpen(true)}
                      >
                        <Trash2 className="size-4" /> Delete
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        <h1 className="mt-4 text-2xl font-bold leading-tight sm:text-3xl">{question.title}</h1>
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <EyeOff className="size-3.5" aria-hidden />
          {question.isOwn ? 'You asked this anonymously' : 'Asked by an anonymous student'} ·{' '}
          <time dateTime={question.createdAt} title={formatDateTime(question.createdAt)}>
            {timeAgo(question.createdAt)}
          </time>
        </p>
        <Markdown className="mt-5">{question.description}</Markdown>
      </article>

      <div className="mt-6">
        <AiExplanationPanel questionId={question.id} available={aiStatus?.available ?? false} />
      </div>

      <section aria-labelledby="answers-heading" className="mt-8 space-y-4">
        <h2 id="answers-heading" className="flex items-center gap-2 text-lg font-semibold">
          <MessageSquare className="size-5 text-muted-foreground" aria-hidden />
          {pluralize(answers.length, 'answer')} from people
        </h2>
        {answersQuery.isPending ? (
          <Skeleton className="h-28 w-full" />
        ) : answers.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No answers yet"
            description={
              question.isOwn
                ? 'Teachers in this subject have been notified.'
                : 'Know the answer? Help a classmate out.'
            }
          />
        ) : (
          answers.map((a) => <AnswerItem key={a.id} answer={a} question={question} />)
        )}
        {canAnswer && !question.isOwn && <AnswerComposer question={question} />}
        {question.status === 'CLOSED' && (
          <p className="flex items-center gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
            <Lock className="size-4" aria-hidden /> This question is closed to new answers.
          </p>
        )}
      </section>

      <CommentsSection question={question} />

      {question.isOwn && (
        <EditQuestionDialog
          key={question.updatedAt}
          question={question}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this question?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the question and its discussion.
            </AlertDialogDescription>
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
    </div>
  );
}
