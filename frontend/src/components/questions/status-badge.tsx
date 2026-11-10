import { CheckCircle2, CircleDot, EyeOff, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { QuestionStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

const CONFIG: Record<QuestionStatus, { label: string; icon: typeof CircleDot; className: string }> =
  {
    OPEN: {
      label: 'Open',
      icon: CircleDot,
      className: 'border-primary/30 bg-primary/10 text-primary',
    },
    ANSWERED: {
      label: 'Answered',
      icon: CheckCircle2,
      className: 'border-success/30 bg-success/10 text-success',
    },
    CLOSED: {
      label: 'Closed',
      icon: Lock,
      className: 'border-border bg-muted text-muted-foreground',
    },
    FLAGGED: {
      label: 'Under review',
      icon: EyeOff,
      className: 'border-destructive/30 bg-destructive/10 text-destructive',
    },
  };

export function StatusBadge({ status, className }: { status: QuestionStatus; className?: string }) {
  const { label, icon: Icon, className: tone } = CONFIG[status];
  return (
    <Badge variant="outline" className={cn('gap-1 font-medium', tone, className)}>
      <Icon className="size-3" aria-hidden />
      {label}
    </Badge>
  );
}
