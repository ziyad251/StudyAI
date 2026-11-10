import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  Loader2,
  MoreHorizontal,
  Search,
  ShieldBan,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState, ErrorState, ListSkeleton, PageHeader, Pagination } from '@/components/common';
import { useAuth } from '@/features/auth/context';
import { passwordSchema } from '@/features/auth/schemas';
import { useDebounce } from '@/hooks/use-debounce';
import { useSubjects } from '@/hooks/use-subjects';
import { api } from '@/lib/api';
import { ApiError, errorMessage } from '@/lib/api-client';
import { ROLE_LABELS, formatDate, timeAgo } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import type { AdminUser, Role } from '@/lib/types';
import { cn } from '@/lib/utils';

function SubjectPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const { data: subjects = [] } = useSubjects();
  return (
    <div className="grid max-h-56 gap-1 overflow-y-auto rounded-lg border p-2 sm:grid-cols-2">
      {subjects.map((s) => {
        const checked = value.includes(s.id);
        return (
          <label
            key={s.id}
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent',
              checked && 'bg-primary/10',
            )}
          >
            <input
              type="checkbox"
              className="accent-[var(--primary)]"
              checked={checked}
              onChange={(e) =>
                onChange(e.target.checked ? [...value, s.id] : value.filter((id) => id !== s.id))
              }
            />
            <span className="truncate">
              {s.code} · {s.name}
            </span>
          </label>
        );
      })}
    </div>
  );
}

function CreateUserDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'TEACHER' as Role,
    department: '',
  });
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const create = useMutation({
    mutationFn: () =>
      api.admin.createUser({
        ...form,
        subjectIds: form.role === 'TEACHER' ? subjectIds : undefined,
      }),
    onSuccess: (user) => {
      toast.success(
        `${ROLE_LABELS[user.role]} account created for ${user.email}. Share the temporary password securely.`,
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
      setForm({ fullName: '', email: '', password: '', role: 'TEACHER', department: '' });
      setSubjectIds([]);
      onOpenChange(false);
    },
    onError: (e) => {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length) setErrors(e.fieldErrors);
      else toast.error(errorMessage(e));
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const pw = passwordSchema.safeParse(form.password);
    if (!pw.success) return setErrors({ password: pw.error.issues[0]!.message });
    setErrors({});
    create.mutate();
  };
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Provision an account</DialogTitle>
          <DialogDescription>
            Teacher and admin accounts can only be created here – never through public registration.
          </DialogDescription>
        </DialogHeader>
        <form id="create-user" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cu-name">Full name</Label>
            <Input id="cu-name" value={form.fullName} onChange={set('fullName')} required />
            {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="cu-email">Email</Label>
            <Input id="cu-email" type="email" value={form.email} onChange={set('email')} required />
            {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="cu-role">Role</Label>
            <Select
              value={form.role}
              onValueChange={(v) => setForm((f) => ({ ...f, role: v as Role }))}
            >
              <SelectTrigger id="cu-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TEACHER">Teacher</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="STUDENT">Student</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cu-dept">Department</Label>
            <Input id="cu-dept" value={form.department} onChange={set('department')} required />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="cu-password">Temporary password</Label>
            <Input
              id="cu-password"
              type="text"
              autoComplete="off"
              value={form.password}
              onChange={set('password')}
              required
            />
            {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
          </div>
          {form.role === 'TEACHER' && (
            <div className="space-y-2 sm:col-span-2">
              <Label>Subjects taught</Label>
              <SubjectPicker value={subjectIds} onChange={setSubjectIds} />
            </div>
          )}
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="create-user" disabled={create.isPending}>
            {create.isPending && <Loader2 className="size-4 animate-spin" />} Create account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SubjectsDialog({ user, onClose }: { user: AdminUser | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: queryKeys.admin.user(user?.id ?? ''),
    queryFn: () => api.admin.user(user!.id),
    enabled: Boolean(user),
  });
  const [selected, setSelected] = useState<string[] | null>(null);
  const value = selected ?? detail.data?.subjects?.map((s) => s.id) ?? [];
  const save = useMutation({
    mutationFn: () => api.admin.setTeacherSubjects(user!.id, value),
    onSuccess: () => {
      toast.success('Subjects updated.');
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
      setSelected(null);
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog
      open={Boolean(user)}
      onOpenChange={(o) => {
        if (!o) {
          setSelected(null);
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Subjects for {user?.fullName}</DialogTitle>
          <DialogDescription>
            The teacher sees and is notified about questions in these subjects.
          </DialogDescription>
        </DialogHeader>
        {detail.isPending ? (
          <ListSkeleton rows={2} />
        ) : (
          <SubjectPicker value={value} onChange={setSelected} />
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || detail.isPending}>
            {save.isPending && <Loader2 className="size-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UsersPage() {
  const { user: me } = useAuth();
  const queryClient = useQueryClient();
  const initial = new URLSearchParams(window.location.search);
  const [page, setPage] = useState(1);
  const [role, setRole] = useState<string>('all');
  const [status, setStatus] = useState<string>(
    initial.get('isActive') === 'false' ? 'suspended' : 'all',
  );
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search.trim());
  const [createOpen, setCreateOpen] = useState(false);
  const [subjectsFor, setSubjectsFor] = useState<AdminUser | null>(null);

  const params = {
    page,
    pageSize: 15,
    role: role === 'all' ? undefined : (role as Role),
    isActive: status === 'all' ? undefined : status === 'active',
    search: debounced || undefined,
  };
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.admin.users(params),
    queryFn: () => api.admin.users(params),
    placeholderData: keepPreviousData,
  });

  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { role?: Role; isActive?: boolean } }) =>
      api.admin.updateUser(id, body),
    onSuccess: (u) => {
      toast.success(`${u.fullName} updated.`);
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <>
      <PageHeader
        title="Users"
        description="Manage students, teachers and administrators."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <UserPlus className="size-4" /> Add teacher / admin
          </Button>
        }
      />
      <div className="mb-4 grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search name, email or department…"
            aria-label="Search users"
          />
        </div>
        <Select
          value={role}
          onValueChange={(v) => {
            setRole(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full md:w-36" aria-label="Role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="STUDENT">Students</SelectItem>
            <SelectItem value="TEACHER">Teachers</SelectItem>
            <SelectItem value="ADMIN">Admins</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full md:w-36" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isPending ? (
        <ListSkeleton />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState icon={Users} title="No users found" />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden md:table-cell">Department</TableHead>
                  <TableHead className="hidden lg:table-cell">Last login</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <p className="font-medium">{u.fullName}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.role === 'STUDENT' ? 'secondary' : 'outline'}>
                        {ROLE_LABELS[u.role]}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {u.department}
                      {u.academicYear ? (
                        <span className="text-muted-foreground"> · Year {u.academicYear}</span>
                      ) : null}
                    </TableCell>
                    <TableCell
                      className="hidden text-sm text-muted-foreground lg:table-cell"
                      title={`Joined ${formatDate(u.createdAt)}`}
                    >
                      {u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'Never'}
                    </TableCell>
                    <TableCell>
                      {u.isActive ? (
                        <Badge variant="outline" className="border-success/40 text-success">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-destructive/40 text-destructive">
                          Suspended
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={`Actions for ${u.fullName}`}
                            disabled={u.email === me?.email}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {u.role === 'TEACHER' && (
                            <DropdownMenuItem onSelect={() => setSubjectsFor(u)}>
                              <BookOpen className="size-4" /> Assign subjects
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuLabel className="text-xs text-muted-foreground">
                            Change role
                          </DropdownMenuLabel>
                          {(['STUDENT', 'TEACHER', 'ADMIN'] as Role[])
                            .filter((r) => r !== u.role)
                            .map((r) => (
                              <DropdownMenuItem
                                key={r}
                                onSelect={() => update.mutate({ id: u.id, body: { role: r } })}
                              >
                                Make {ROLE_LABELS[r].toLowerCase()}
                              </DropdownMenuItem>
                            ))}
                          <DropdownMenuSeparator />
                          {u.isActive ? (
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onSelect={() =>
                                update.mutate({ id: u.id, body: { isActive: false } })
                              }
                            >
                              <ShieldBan className="size-4" /> Suspend account
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onSelect={() => update.mutate({ id: u.id, body: { isActive: true } })}
                            >
                              <ShieldCheck className="size-4" /> Reactivate account
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination
            page={data.pagination.page}
            totalPages={data.pagination.totalPages}
            onPageChange={setPage}
          />
        </>
      )}
      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />
      <SubjectsDialog user={subjectsFor} onClose={() => setSubjectsFor(null)} />
    </>
  );
}
