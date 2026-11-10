import { useMutation } from '@tanstack/react-query';
import { Bot, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Markdown } from '@/components/markdown';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/api-client';
import { timeAgo } from '@/lib/format';

export function AiExplanationPanel({
  questionId,
  available,
}: {
  questionId: string;
  available: boolean;
}) {
  const explain = useMutation({ mutationFn: () => api.ai.explainQuestion(questionId) });

  return (
    <section
      aria-labelledby="ai-heading"
      className="rounded-xl border border-ai/30 bg-ai-soft/60 p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="ai-heading" className="flex items-center gap-2 font-semibold">
          <span className="flex size-7 items-center justify-center rounded-lg bg-ai text-white">
            <Sparkles className="size-4" aria-hidden />
          </span>
          AI explanation
          <span className="rounded-full border border-ai/40 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-ai">
            AI-generated
          </span>
        </h2>
        {!explain.data && (
          <Button
            size="sm"
            className="bg-ai text-white hover:bg-ai/90"
            disabled={!available || explain.isPending}
            onClick={() => explain.mutate()}
          >
            {explain.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Bot className="size-4" />
            )}
            {explain.isPending ? 'Thinking…' : 'Explain with AI'}
          </Button>
        )}
      </div>

      {!available && (
        <p className="mt-3 text-sm text-muted-foreground">
          The AI assistant is not available right now.
        </p>
      )}
      {available && !explain.data && !explain.isError && !explain.isPending && (
        <p className="mt-3 text-sm text-muted-foreground">
          Get an instant explanation while you wait for teachers and classmates. AI can make
          mistakes.
        </p>
      )}
      {explain.isPending && (
        <div className="mt-4 space-y-2" aria-busy="true">
          <div className="h-3 w-11/12 animate-pulse rounded bg-ai/15" />
          <div className="h-3 w-10/12 animate-pulse rounded bg-ai/15" />
          <div className="h-3 w-8/12 animate-pulse rounded bg-ai/15" />
        </div>
      )}
      {explain.isError && (
        <div className="mt-3 flex items-center gap-3 text-sm" role="alert">
          <span className="text-destructive">{errorMessage(explain.error)}</span>
          <Button size="sm" variant="outline" onClick={() => explain.mutate()}>
            <RefreshCw className="size-3.5" /> Retry
          </Button>
        </div>
      )}
      {explain.data && (
        <div className="mt-4 animate-in fade-in">
          <Markdown>{explain.data.content}</Markdown>
          <p className="mt-4 border-t border-ai/20 pt-3 text-xs text-muted-foreground">
            {explain.data.disclaimer} · Generated {timeAgo(explain.data.generatedAt)}
          </p>
        </div>
      )}
    </section>
  );
}
