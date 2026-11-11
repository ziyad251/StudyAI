import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Clock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldError } from '@/components/common';
import { homePathFor, useAuth } from '@/features/auth/context';
import { loginSchema, type LoginValues } from '@/features/auth/schemas';
import { errorMessage } from '@/lib/api-client';
import { SESSION_END_MESSAGES, clearSessionEndReason, peekSessionEndReason } from '@/lib/session';
import { AuthLayout } from './auth-layout';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  // Read during render, cleared after mount, so the notice shows once and survives StrictMode.
  const [sessionEnd] = useState(peekSessionEndReason);
  useEffect(clearSessionEndReason, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const user = await login(values.email, values.password);
      toast.success(`Welcome back, ${user.fullName.split(' ')[0]}!`);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== '/login' ? from : homePathFor(user.role), { replace: true });
    } catch (error) {
      setServerError(errorMessage(error));
    }
  });

  return (
    <AuthLayout
      title="Welcome back"
      subtitle={
        <>
          New to StudyAI?{' '}
          <Link to="/register" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {serverError ? (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        ) : (
          sessionEnd && (
            <Alert role="status">
              <Clock className="size-4" />
              <AlertDescription>{SESSION_END_MESSAGES[sessionEnd]}</AlertDescription>
            </Alert>
          )
        )}
        <div className="space-y-2">
          <Label htmlFor="email">College email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@college.edu"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'email-error' : undefined}
            {...register('email')}
          />
          <FieldError id="email-error" message={errors.email?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              className="pr-10"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'password-error' : undefined}
              {...register('password')}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <FieldError id="password-error" message={errors.password?.message} />
        </div>
        <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />} Sign in
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Teacher and admin accounts are created by your institution’s StudyAI administrator.
        </p>
      </form>
    </AuthLayout>
  );
}
