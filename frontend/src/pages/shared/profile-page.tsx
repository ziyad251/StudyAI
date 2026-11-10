import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2, Lock, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FieldError, PageHeader } from '@/components/common';
import { useAuth } from '@/features/auth/context';
import { passwordSchema } from '@/features/auth/schemas';
import { api } from '@/lib/api';
import { ApiError, errorMessage } from '@/lib/api-client';
import { ROLE_LABELS, formatDate } from '@/lib/format';

export function ProfilePage() {
  const { user, setUser } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [department, setDepartment] = useState(user?.department ?? '');
  const [academicYear, setAcademicYear] = useState(String(user?.academicYear ?? ''));
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string>();

  const saveProfile = useMutation({
    mutationFn: () =>
      api.users.updateProfile({
        fullName,
        department,
        ...(user?.role === 'STUDENT' && academicYear ? { academicYear: Number(academicYear) } : {}),
      }),
    onSuccess: (updated) => {
      setUser(updated);
      toast.success('Profile updated.');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const changePassword = useMutation({
    mutationFn: () => api.users.changePassword({ currentPassword, newPassword }),
    onSuccess: (updated) => {
      setUser(updated);
      setCurrentPassword('');
      setNewPassword('');
      toast.success('Password changed. Other devices have been signed out.');
    },
    onError: (e) => {
      if (e instanceof ApiError) {
        const fields = e.fieldErrors;
        setPasswordError(fields.currentPassword ?? fields.newPassword ?? e.message);
      } else toast.error(errorMessage(e));
    },
  });

  if (!user) return null;

  const submitPassword = (e: React.FormEvent) => {
    e.preventDefault();
    const result = passwordSchema.safeParse(newPassword);
    if (!result.success) return setPasswordError(result.error.issues[0]?.message);
    setPasswordError(undefined);
    changePassword.mutate();
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Profile & settings"
        description="Manage your account details and password."
      />
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>
              {ROLE_LABELS[user.role]} · Member since {formatDate(user.createdAt)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                saveProfile.mutate();
              }}
            >
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="profile-email">Email</Label>
                <Input id="profile-email" value={user.email} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-name">Full name</Label>
                <Input
                  id="profile-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-dept">Department</Label>
                <Input
                  id="profile-dept"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                />
              </div>
              {user.role === 'STUDENT' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="profile-year">Academic year</Label>
                    <Select value={academicYear} onValueChange={setAcademicYear}>
                      <SelectTrigger id="profile-year" className="w-full">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6].map((y) => (
                          <SelectItem key={y} value={String(y)}>
                            Year {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profile-roll">Roll number</Label>
                    <Input id="profile-roll" value={user.rollNumber ?? '—'} disabled />
                  </div>
                </>
              )}
              <div className="sm:col-span-2">
                <Button
                  type="submit"
                  disabled={
                    saveProfile.isPending ||
                    fullName.trim().length < 2 ||
                    department.trim().length < 2
                  }
                >
                  {saveProfile.isPending && <Loader2 className="size-4 animate-spin" />} Save
                  changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="size-4" aria-hidden /> Change password
            </CardTitle>
            <CardDescription>
              Changing your password signs you out on every other device.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={submitPassword}>
              <div className="space-y-2">
                <Label htmlFor="current-password">Current password</Label>
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2 space-y-3">
                <FieldError message={passwordError} />
                <Button
                  type="submit"
                  variant="outline"
                  disabled={!currentPassword || !newPassword || changePassword.isPending}
                >
                  {changePassword.isPending && <Loader2 className="size-4 animate-spin" />} Update
                  password
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="border-success/30 bg-success/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4 text-success" aria-hidden /> How your privacy is
              protected
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Other students and teachers never see who asked a question – not your name, email,
              roll number or any account id.
            </p>
            <p>
              StudyAI keeps an internal link between you and your questions so you can manage them
              and so moderators can act on abuse. Administrators can suspend an account linked to
              abusive content, but the admin interface does not show question authors.
            </p>
            <p>
              Anonymity has limits: the content and timing of a question, or details you include,
              may still let people guess who wrote it.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
