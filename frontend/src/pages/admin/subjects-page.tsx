import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LibraryBig, Loader2, Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState, ErrorState, ListSkeleton, PageHeader } from '@/components/common';
import { useSubjects } from '@/hooks/use-subjects';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/api-client';
import type { Subject } from '@/lib/types';

function SubjectDialog({
  subject,
  open,
  onOpenChange,
}: {
  subject: Subject | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: subject?.name ?? '',
    code: subject?.code ?? '',
    category: subject?.category ?? '',
    description: subject?.description ?? '',
  });
  const save = useMutation({
    mutationFn: () =>
      subject
        ? api.subjects.update(subject.id, { ...form, description: form.description || null })
        : api.subjects.create({ ...form, description: form.description || undefined }),
    onSuccess: () => {
      toast.success(subject ? 'Subject updated.' : 'Subject created.');
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const set =
    (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{subject ? 'Edit subject' : 'New subject'}</DialogTitle>
        </DialogHeader>
        <form
          id="subject-form"
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="s-name">Name</Label>
            <Input id="s-name" value={form.name} onChange={set('name')} required minLength={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="s-code">Code</Label>
            <Input
              id="s-code"
              value={form.code}
              onChange={set('code')}
              required
              placeholder="CS401"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="s-category">Category</Label>
            <Input
              id="s-category"
              value={form.category}
              onChange={set('category')}
              required
              placeholder="Systems"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="s-desc">Description</Label>
            <Textarea
              id="s-desc"
              value={form.description}
              onChange={set('description')}
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              The description helps the AI classifier route questions to this subject.
            </p>
          </div>
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="subject-form" disabled={save.isPending}>
            {save.isPending && <Loader2 className="size-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SubjectsPage() {
  const queryClient = useQueryClient();
  const { data, isPending, isError, error, refetch } = useSubjects(true);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [open, setOpen] = useState(false);

  const toggle = useMutation({
    mutationFn: (s: Subject) => api.subjects.update(s.id, { isActive: !s.isActive }),
    onSuccess: (s) => {
      toast.success(`${s.name} ${s.isActive ? 'activated' : 'deactivated'}.`);
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const openDialog = (s: Subject | null) => {
    setEditing(s);
    setOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Subjects"
        description="The catalogue students choose from and the AI classifier routes questions into."
        actions={
          <Button onClick={() => openDialog(null)}>
            <Plus className="size-4" /> New subject
          </Button>
        }
      />
      {isPending ? (
        <ListSkeleton />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : data.length === 0 ? (
        <EmptyState icon={LibraryBig} title="No subjects yet" />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead className="hidden md:table-cell">Category</TableHead>
                <TableHead className="text-right">Questions</TableHead>
                <TableHead className="text-right">Teachers</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="w-10">
                  <span className="sr-only">Edit</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((s) => (
                <TableRow key={s.id} className={s.isActive ? undefined : 'opacity-60'}>
                  <TableCell>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.code}</p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant="secondary">{s.category}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{s.questionCount ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.teacherCount ?? 0}</TableCell>
                  <TableCell>
                    <Switch
                      checked={s.isActive}
                      onCheckedChange={() => toggle.mutate(s)}
                      aria-label={`${s.isActive ? 'Deactivate' : 'Activate'} ${s.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => openDialog(s)}
                      aria-label={`Edit ${s.name}`}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {open && (
        <SubjectDialog
          key={editing?.id ?? 'new'}
          subject={editing}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </>
  );
}
