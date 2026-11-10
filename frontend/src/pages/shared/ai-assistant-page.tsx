import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Bot, Loader2, Send, Sparkles, UserRound } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/common';
import { Markdown } from '@/components/markdown';
import { useAiStatus, useSubjects } from '@/hooks/use-subjects';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/api-client';

interface Turn {
  id: number;
  prompt: string;
  subject?: string;
  answer?: string;
  error?: string;
}

const EXAMPLES = [
  'Explain the difference between processes and threads with an analogy.',
  'Why is binary search O(log n)?',
  'What problem does database indexing solve, and what does it cost?',
];

export function AiAssistantPage() {
  const { data: aiStatus } = useAiStatus();
  const { data: subjects = [] } = useSubjects();
  const [prompt, setPrompt] = useState('');
  const [subjectId, setSubjectId] = useState('any');
  const [turns, setTurns] = useState<Turn[]>([]);
  const nextId = useRef(0);

  const ask = useMutation({
    mutationFn: (input: { prompt: string; subjectId?: string }) =>
      api.ai.ask(input.prompt, input.subjectId),
  });

  const submit = (text = prompt) => {
    const trimmed = text.trim();
    if (trimmed.length < 10 || ask.isPending) return;
    const id = ++nextId.current;
    const subject = subjects.find((s) => s.id === subjectId);
    setTurns((t) => [...t, { id, prompt: trimmed, subject: subject?.name }]);
    setPrompt('');
    ask.mutate(
      { prompt: trimmed, subjectId: subject?.id },
      {
        onSuccess: (res) =>
          setTurns((t) => t.map((x) => (x.id === id ? { ...x, answer: res.content } : x))),
        onError: (e) =>
          setTurns((t) => t.map((x) => (x.id === id ? { ...x, error: errorMessage(e) } : x))),
      },
    );
  };

  const unavailable = aiStatus && !aiStatus.available;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="AI assistant"
        description="Ask for an explanation of any academic concept. Answers are AI-generated and can contain mistakes."
      />
      {unavailable && (
        <Alert className="mb-4">
          <AlertDescription>
            The AI assistant is not configured on this server right now. Please try again later.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-5" aria-live="polite">
        {turns.length === 0 && (
          <div className="rounded-2xl border border-dashed p-8 text-center">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-ai-soft text-ai">
              <Sparkles className="size-6" aria-hidden />
            </div>
            <p className="font-medium">What would you like to understand?</p>
            <div className="mt-4 flex flex-col gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  className="rounded-lg border bg-card px-3 py-2 text-left text-sm hover:border-ai/50 hover:bg-ai-soft/40 disabled:opacity-50"
                  onClick={() => submit(ex)}
                  disabled={Boolean(unavailable)}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}
        {turns.map((turn) => (
          <div key={turn.id} className="space-y-3">
            <div className="flex justify-end gap-2">
              <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                {turn.subject && <p className="mb-1 text-xs opacity-80">{turn.subject}</p>}
                {turn.prompt}
              </div>
              <span
                className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted"
                aria-hidden
              >
                <UserRound className="size-4" />
              </span>
            </div>
            <div className="flex gap-2">
              <span
                className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-ai text-white"
                aria-hidden
              >
                <Bot className="size-4" />
              </span>
              <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm border border-ai/30 bg-ai-soft/60 px-4 py-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ai">
                  AI-generated
                </p>
                {turn.answer ? (
                  <Markdown>{turn.answer}</Markdown>
                ) : turn.error ? (
                  <p className="text-sm text-destructive" role="alert">
                    {turn.error}
                  </p>
                ) : (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> Thinking…
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <form
        className="sticky bottom-4 mt-6 rounded-2xl border bg-card p-3 shadow-lg"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Ask about a concept… (Enter to send, Shift+Enter for a new line)"
          rows={2}
          maxLength={2000}
          className="resize-none border-0 shadow-none focus-visible:ring-0"
          aria-label="Your question for the AI assistant"
          disabled={Boolean(unavailable)}
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <Select value={subjectId} onValueChange={setSubjectId}>
            <SelectTrigger className="h-8 w-56 text-xs" aria-label="Subject context">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any subject</SelectItem>
              {subjects.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="submit"
            size="sm"
            className="bg-ai text-white hover:bg-ai/90"
            disabled={prompt.trim().length < 10 || ask.isPending || Boolean(unavailable)}
          >
            {ask.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}{' '}
            Ask
          </Button>
        </div>
      </form>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Conversations aren’t saved. Never share personal information with the assistant.
      </p>
    </div>
  );
}
