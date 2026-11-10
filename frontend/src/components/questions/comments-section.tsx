import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, MessagesSquare, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/features/auth/context';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import type { Question } from '@/lib/types';
import { AuthorLine } from './answer-item';

export function CommentsSection({ question }: { question: Question }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const { data: comments = [], isPending } = useQuery({
    queryKey: queryKeys.questions.comments(question.id),
    queryFn: () => api.questions.comments(question.id),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.questions.comments(question.id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.questions.detail(question.id) });
  };
  const add = useMutation({
    mutationFn: () => api.questions.addComment(question.id, draft.trim()),
    onSuccess: () => {
      setDraft('');
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.comments.remove(id),
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const locked = question.status === 'CLOSED' || question.status === 'FLAGGED';

  return (
    <section aria-labelledby="comments-heading" className="mt-8">
      <h2 id="comments-heading" className="mb-3 flex items-center gap-2 text-lg font-semibold">
        <MessagesSquare className="size-5 text-muted-foreground" aria-hidden /> Discussion
        <span className="text-sm font-normal text-muted-foreground">({comments.length})</span>
      </h2>
      <div className="rounded-xl border bg-card">
        {isPending ? (
          <p className="p-4 text-sm text-muted-foreground">Loading comments…</p>
        ) : comments.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No comments yet. Ask for clarification or say thanks.
          </p>
        ) : (
          <ul className="divide-y">
            {comments.map((c) => (
              <li key={c.id} className="group p-4">
                <div className="flex items-start justify-between gap-2">
                  <AuthorLine author={c.author} isOwn={c.isOwn} createdAt={c.createdAt} />
                  {(c.isOwn || user?.role === 'ADMIN') && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 opacity-60 hover:opacity-100"
                      aria-label="Delete comment"
                      onClick={() => remove.mutate(c.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-wrap pl-9 text-sm">{c.content}</p>
              </li>
            ))}
          </ul>
        )}
        {!locked && (
          <form
            className="flex flex-col gap-2 border-t p-4 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim().length >= 2) add.mutate();
            }}
          >
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add a comment…"
              rows={2}
              maxLength={1000}
              aria-label="Add a comment"
              className="min-h-0"
            />
            <Button
              type="submit"
              variant="secondary"
              disabled={draft.trim().length < 2 || add.isPending}
            >
              {add.isPending && <Loader2 className="size-4 animate-spin" />} Comment
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}
