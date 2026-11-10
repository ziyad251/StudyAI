import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FieldError } from '@/components/common';
import { useAuth } from '@/features/auth/context';
import { passwordRules, registerSchema, type RegisterValues } from '@/features/auth/schemas';
import { ApiError, errorMessage } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { AuthLayout } from './auth-layout';

export function RegisterPage() {
  const { register: registerAccount } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      department: '',
      academicYear: '',
      rollNumber: '',
      password: '',
      confirmPassword: '',
    },
  });
  const password = useWatch({ control, name: 'password' }) ?? '';

  const onSubmit = handleSubmit(
    async ({ confirmPassword: _confirm, academicYear, rollNumber, ...values }) => {
      setServerError(null);
      try {
        await registerAccount({
          ...values,
          academicYear: Number(academicYear),
          rollNumber: rollNumber || undefined,
        });
        toast.success('Account created. Welcome to StudyAI!');
        navigate('/dashboard', { replace: true });
      } catch (error) {
        if (error instanceof ApiError) {
          const fields = error.fieldErrors;
          for (const [path, message] of Object.entries(fields)) {
            setError(path as keyof RegisterValues, { message });
          }
          if (error.code === 'EMAIL_TAKEN') setError('email', { message: error.message });
          if (error.code === 'ROLL_NUMBER_TAKEN')
            setError('rollNumber', { message: error.message });
          if (Object.keys(fields).length && error.code === 'VALIDATION_ERROR') return;
        }
        setServerError(errorMessage(error));
      }
    },
  );

  const field = (name: keyof RegisterValues) => ({
    'aria-invalid': Boolean(errors[name]),
    'aria-describedby': errors[name] ? `${name}-error` : undefined,
  });

  return (
    <AuthLayout
      title="Create your account"
      subtitle={
        <>
          Already registered?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {serverError && (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}
        <div className="space-y-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input
            id="fullName"
            autoComplete="name"
            {...field('fullName')}
            {...register('fullName')}
          />
          <FieldError id="fullName-error" message={errors.fullName?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">College email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@college.edu"
            {...field('email')}
            {...register('email')}
          />
          <FieldError id="email-error" message={errors.email?.message} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="department">Department</Label>
            <Input
              id="department"
              placeholder="Computer Science"
              {...field('department')}
              {...register('department')}
            />
            <FieldError id="department-error" message={errors.department?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="academicYear">Academic year</Label>
            <Controller
              control={control}
              name="academicYear"
              render={({ field: f }) => (
                <Select value={f.value} onValueChange={f.onChange}>
                  <SelectTrigger id="academicYear" className="w-full" {...field('academicYear')}>
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6].map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        Year {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError id="academicYear-error" message={errors.academicYear?.message} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="rollNumber">
            Roll number <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input id="rollNumber" {...field('rollNumber')} {...register('rollNumber')} />
          <p className="text-xs text-muted-foreground">
            Private – used only for account management, never shown to other students.
          </p>
          <FieldError id="rollNumber-error" message={errors.rollNumber?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            {...field('password')}
            {...register('password')}
          />
          <ul className="grid grid-cols-2 gap-1 pt-1 text-xs" aria-label="Password requirements">
            {passwordRules.map((rule) => {
              const ok = rule.test(password);
              return (
                <li
                  key={rule.label}
                  className={cn(
                    'flex items-center gap-1',
                    ok ? 'text-success' : 'text-muted-foreground',
                  )}
                >
                  {ok ? (
                    <Check className="size-3" aria-hidden />
                  ) : (
                    <X className="size-3" aria-hidden />
                  )}
                  {rule.label}
                </li>
              );
            })}
          </ul>
          <FieldError id="password-error" message={errors.password?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            {...field('confirmPassword')}
            {...register('confirmPassword')}
          />
          <FieldError id="confirmPassword-error" message={errors.confirmPassword?.message} />
        </div>
        <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />} Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
