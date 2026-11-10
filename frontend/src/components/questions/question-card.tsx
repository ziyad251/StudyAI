import { Link } from 'react-router';
import { GraduationCap, MessageSquare, MessagesSquare, Sparkles, UserRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { timeAgo, pluralize } from '@/lib/format';
import type { Question } from '@/lib/types';
import { cn } from '@/lib/utils';
import { StatusBadge } from './status-badge';

export function QuestionCard({ question, className }: { question: Question; className?: string }) {
  return (
    <article
      className={cn(
        'group relative rounded-xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md',
        className,
      )}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="secondary" className="font-medium">
          {question.subject.code} · {question.subject.name}
        </Badge>
        {question.category && (
          <Badge variant="outline" className="gap-1 border-ai/30 text-ai">
            <Sparkles className="size-3" aria-hidden /> {question.category}
          </Badge>
        )}
        <StatusBadge status={question.status} />
      </div>

      <h3 className="text-base font-semibold leading-snug sm:text-lg">
        <Link
          to={`/questions/${question.id}`}
          className="after:absolute after:inset-0 focus-visible:outline-none"
        >
          {question.title}
        </Link>
      </h3>
      <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{question.description}</p>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <UserRound className="size-3.5" aria-hidden />
          {question.isOwn ? 'You asked' : 'Anonymous student'}
        </span>
        <span>{timeAgo(question.createdAt)}</span>
        <span className="inline-flex items-center gap-1">
          <MessageSquare className="size-3.5" aria-hidden />
          {pluralize(question.answerCount, 'answer')}
        </span>
        {question.commentCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <MessagesSquare className="size-3.5" aria-hidden />
            {pluralize(question.commentCount, 'comment')}
          </span>
        )}
        {question.hasTeacherAnswer && (
          <span className="inline-flex items-center gap-1 font-medium text-success">
            <GraduationCap className="size-3.5" aria-hidden /> Teacher answered
          </span>
        )}
      </div>
    </article>
  );
}
