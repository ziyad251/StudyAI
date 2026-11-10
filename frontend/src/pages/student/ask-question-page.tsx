import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, EyeOff, Info, Loader2, ShieldCheck, Sparkles, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FieldError, PageHeader } from '@/components/common';
import { QUESTION_LIMITS, questionSchema, type QuestionValues } from '@/features/auth/schemas';
import { useAiStatus, useSubjects } from '@/hooks/use-subjects';
import { api } from '@/lib/api';
import { ApiError, errorMessage } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import type { Classification, PiiFinding } from '@/lib/types';
import { cn } from '@/lib/utils';

const AUTO = 'auto';

const PII_LABELS: Record<string, string> = {
  EMAIL: 'Email address',
  PHONE: 'Phone number',
  ROLL_NUMBER: 'Roll / registration number',
  SELF_IDENTIFICATION: 'Self-identification',
  SOCIAL_HANDLE: 'Social media handle',
  URL: 'Profile link',
  NAME: 'Name',
  OTHER: 'Identifying detail',
};

function CharCount({ value, max }: { value: string; max: number }) {
  const len = value.length;
  return (
    <span
      className={cn(
        'text-xs tabular-nums',
        len > max ? 'text-destructive' : 'text-muted-foreground',
      )}
    >
      {len}/{max}
    </span>
  );
}

export function AskQuestionPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: subjects = [] } = useSubjects();
  const { data: aiStatus } = useAiStatus();
  const aiAvailable = aiStatus?.available ?? false;

  const [suggestion, setSuggestion] = useState<Classification | null>(null);
  const [findings, setFindings] = useState<PiiFinding[] | null>(null);
  const [disclaimer, setDisclaimer] = useState<string>('');
  const [checking, setChecking] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    getValues,
    formState: { errors },
  } = useForm<QuestionValues>({
    resolver: zodResolver(questionSchema),
    defaultValues: { title: '', description: '', subjectId: AUTO },
  });
  const [title = '', description = '', subjectId] = useWatch({
    control,
    name: ['title', 'description', 'subjectId'],
  });

  const classify = useMutation({
    mutationFn: () =>
      api.ai.classify({ title: getValues('title'), description: getValues('description') }),
    onSuccess: (result) => setSuggestion(result),
    onError: (error) => toast.error(errorMessage(error)),
  });

  const create = useMutation({
    mutationFn: (acknowledgePersonalInfo: boolean) => {
      const values = getValues();
      return api.questions.create({
        title: values.title,
        description: values.description,
        subjectId: values.subjectId && values.subjectId !== AUTO ? values.subjectId : undefined,
        acknowledgePersonalInfo,
      });
    },
    onSuccess: (question) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.questions.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.studentStats });
      toast.success('Your question was posted anonymously.');
      navigate(`/questions/${question.id}`);
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        if (error.code === 'PERSONAL_INFO_WARNING') {
          const details = error.details as { findings: PiiFinding[] } | undefined;
          setFindings(details?.findings ?? []);
          return;
        }
        if (error.code === 'SUBJECT_REQUIRED') {
          const details = error.details as { suggestion?: Classification } | undefined;
          if (details?.suggestion) setSuggestion(details.suggestion);
          setValue('subjectId', AUTO);
          setError('subjectId', { message: error.message });
          return;
        }
        for (const [path, message] of Object.entries(error.fieldErrors)) {
          setError(path as keyof QuestionValues, { message });
        }
      }
      toast.error(errorMessage(error));
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setChecking(true);
    const check = await api.ai
      .checkPersonalInformation(`${values.title}\n${values.description}`)
      .catch(() => null);
    setChecking(false);
    if (check) {
      setDisclaimer(check.disclaimer);
      if (check.hasPersonalInformation) {
        setFindings(check.findings);
        return;
      }
    }
    create.mutate(false);
  });

  const submitting = checking || create.isPending;

  return (
    <>
      <PageHeader
        title="Ask a question"
        description="Your question is posted anonymously. Classmates and teachers will never see your name, email or roll number."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={onSubmit} className="space-y-5" noValidate>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="title">Title</Label>
                  <CharCount value={title} max={QUESTION_LIMITS.titleMax} />
                </div>
                <Input
                  id="title"
                  placeholder="e.g. What is the difference between 2NF and 3NF?"
                  aria-invalid={Boolean(errors.title)}
                  aria-describedby={errors.title ? 'title-error' : undefined}
                  {...register('title')}
                />
                <FieldError id="title-error" message={errors.title?.message} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="description">Details</Label>
                  <CharCount value={description} max={QUESTION_LIMITS.descriptionMax} />
                </div>
                <Textarea
                  id="description"
                  rows={8}
                  placeholder="Explain what you’ve tried and where you’re stuck. Markdown and code blocks are supported."
                  aria-invalid={Boolean(errors.description)}
                  aria-describedby={errors.description ? 'description-error' : undefined}
                  {...register('description')}
                />
                <FieldError id="description-error" message={errors.description?.message} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Controller
                    control={control}
                    name="subjectId"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger
                          id="subject"
                          className="w-full"
                          aria-invalid={Boolean(errors.subjectId)}
                        >
                          <SelectValue placeholder="Choose a subject" />
                        </SelectTrigger>
                        <SelectContent>
                          {aiAvailable && (
                            <SelectItem value={AUTO}>✨ Let AI choose the subject</SelectItem>
                          )}
                          {subjects.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.code} · {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {aiAvailable && (
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0 border-ai/40 text-ai hover:bg-ai-soft hover:text-ai"
                      disabled={classify.isPending || `${title} ${description}`.trim().length < 10}
                      onClick={() => classify.mutate()}
                    >
                      {classify.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Wand2 className="size-4" />
                      )}
                      Suggest subject
                    </Button>
                  )}
                </div>
                <FieldError message={errors.subjectId?.message} />
                {!aiAvailable && aiStatus && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Info className="size-3.5" aria-hidden /> AI suggestions are unavailable right
                    now – please choose a subject.
                  </p>
                )}
                {suggestion && (
                  <div className="flex flex-wrap items-center gap-3 rounded-lg border border-ai/30 bg-ai-soft p-3 text-sm animate-in fade-in slide-in-from-top-1">
                    <Sparkles className="size-4 text-ai" aria-hidden />
                    <span>
                      AI suggests <strong>{suggestion.subject}</strong>
                      <span className="text-muted-foreground"> · {suggestion.category}</span>
                    </span>
                    <Badge variant="outline" className="border-ai/40 text-ai">
                      {Math.round(suggestion.confidence * 100)}% confident
                    </Badge>
                    {subjectId !== suggestion.subjectId && (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="ml-auto"
                        onClick={() =>
                          setValue('subjectId', suggestion.subjectId, { shouldValidate: true })
                        }
                      >
                        Use this subject
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <EyeOff className="size-3.5" aria-hidden /> Posted as “Anonymous student”
                </p>
                <Button type="submit" size="lg" disabled={submitting}>
                  {submitting && <Loader2 className="size-4 animate-spin" />}
                  {checking ? 'Checking privacy…' : 'Post anonymously'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <aside className="space-y-4">
          <Card className="gap-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="size-4 text-success" aria-hidden /> Stay anonymous
              </CardTitle>
              <CardDescription>
                Before posting, double-check that your question doesn’t include:
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Your name or a classmate’s name</li>
                <li>Roll or registration numbers</li>
                <li>Phone numbers, emails or social handles</li>
                <li>Details only you would know (e.g. “I sit in the front row of section B”)</li>
              </ul>
            </CardContent>
          </Card>
          <Card className="gap-3">
            <CardHeader>
              <CardTitle className="text-base">Tips for great answers</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Be specific in the title</li>
                <li>Say what you already understand</li>
                <li>Paste code or error messages in code blocks</li>
              </ul>
            </CardContent>
          </Card>
        </aside>
      </div>

      <Dialog open={findings !== null} onOpenChange={(open) => !open && setFindings(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-warning" aria-hidden /> Review your question
            </DialogTitle>
            <DialogDescription>
              Your question may contain personal information. Please review it before submitting.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2" aria-label="Possible personal information">
            {findings?.map((f, i) => (
              <li key={`${f.type}-${i}`} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{PII_LABELS[f.type] ?? f.type}</span>
                  <Badge variant="outline" className="text-xs">
                    {f.source === 'AI' ? 'AI check' : 'Pattern check'}
                  </Badge>
                </div>
                <p className="mt-1 font-mono text-xs text-muted-foreground">{f.excerpt}</p>
                <p className="mt-1 text-muted-foreground">{f.message}</p>
              </li>
            ))}
          </ul>
          <Alert>
            <Info className="size-4" />
            <AlertTitle>Automated checks aren’t perfect</AlertTitle>
            <AlertDescription>
              {disclaimer ||
                'Automated checks help catch common identifying details but cannot guarantee that everything is detected.'}
            </AlertDescription>
          </Alert>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => {
                setFindings(null);
                create.mutate(true);
              }}
              disabled={create.isPending}
            >
              Post anyway
            </Button>
            <Button onClick={() => setFindings(null)}>Edit my question</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
