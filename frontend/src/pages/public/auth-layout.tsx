import type { ReactNode } from 'react';
import { EyeOff, ShieldCheck, Sparkles } from 'lucide-react';
import { Logo } from '@/components/common';

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col px-4 py-8 sm:px-10">
        <Logo />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="mt-2 text-muted-foreground">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
      <aside className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:flex lg:flex-col lg:justify-center lg:px-14">
        <div
          className="absolute -right-24 -top-24 size-96 rounded-full bg-ai/30 blur-3xl"
          aria-hidden
        />
        <div
          className="absolute -bottom-32 -left-20 size-96 rounded-full bg-white/10 blur-3xl"
          aria-hidden
        />
        <div className="relative max-w-md space-y-8">
          <h2 className="text-4xl font-extrabold leading-tight">
            Curiosity without the spotlight.
          </h2>
          <ul className="space-y-5">
            {[
              { icon: EyeOff, text: 'Classmates never see who asked a question.' },
              { icon: Sparkles, text: 'AI routes your doubt to the right subject in seconds.' },
              {
                icon: ShieldCheck,
                text: 'Your password is hashed with bcrypt and sessions use HttpOnly cookies.',
              },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="text-lg opacity-95">{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
