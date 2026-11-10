import { Link } from 'react-router';
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  EyeOff,
  GraduationCap,
  MessageSquareText,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  UserRoundX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const STEPS = [
  {
    icon: MessageSquareText,
    title: 'Ask anonymously',
    text: 'Write your doubt in your own words. Classmates see the question – never your name, email or roll number.',
  },
  {
    icon: Sparkles,
    title: 'AI sorts it for you',
    text: 'Gemini suggests the right subject and topic so your question reaches the teachers who cover it.',
  },
  {
    icon: GraduationCap,
    title: 'Get real answers',
    text: 'Teachers and classmates answer. You accept the answer that helped, and get notified instantly.',
  },
];

const BENEFITS = [
  {
    icon: UserRoundX,
    title: 'No fear of judgement',
    text: 'Ask the “basic” questions you would never ask in a lecture hall.',
  },
  {
    icon: BrainCircuit,
    title: 'Instant AI explanations',
    text: 'Get a clearly labelled AI explanation while you wait for a teacher.',
  },
  {
    icon: GraduationCap,
    title: 'Verified teachers',
    text: 'Teacher answers are badged, so you know which explanations are authoritative.',
  },
  {
    icon: ShieldCheck,
    title: 'Moderated community',
    text: 'Reports and moderators keep anonymous spaces respectful and on-topic.',
  },
];

export function LandingPage() {
  return (
    <div className="overflow-hidden">
      <section className="relative">
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,color-mix(in_oklch,var(--primary)_18%,transparent),transparent)]"
          aria-hidden
        />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Badge
              variant="outline"
              className="mb-5 gap-1.5 border-ai/40 bg-ai-soft px-3 py-1 text-ai"
            >
              <Sparkles className="size-3.5" aria-hidden /> AI-assisted, privacy-conscious
            </Badge>
            <h1 className="text-4xl font-extrabold leading-[1.1] sm:text-5xl lg:text-6xl">
              Every question deserves an answer.{' '}
              <span className="bg-gradient-to-r from-primary to-ai bg-clip-text text-transparent">
                No judgement.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              StudyAI lets college students ask academic doubts anonymously and get answers from
              teachers, classmates and AI – so nobody stays confused just because they were afraid
              to raise their hand.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/register">
                  Ask your first question <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/login">I already have an account</Link>
              </Button>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {['Free for students', 'Anonymous to classmates', 'Teacher-verified answers'].map(
                (t) => (
                  <li key={t} className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-4 text-success" aria-hidden /> {t}
                  </li>
                ),
              )}
            </ul>
          </div>

          <div
            className="relative animate-in fade-in slide-in-from-bottom-8 duration-700"
            aria-hidden
          >
            <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-br from-primary/20 via-transparent to-ai/20 blur-2xl" />
            <div className="rounded-2xl border bg-card p-5 shadow-xl">
              <div className="mb-3 flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">CS202 · Database Management Systems</Badge>
                <Badge variant="outline" className="gap-1 border-ai/30 text-ai">
                  <Sparkles className="size-3" /> Normalization
                </Badge>
              </div>
              <p className="font-semibold">How does normalization work in DBMS?</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Can someone explain 2NF and 3NF? I keep mixing them up…
              </p>
              <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <EyeOff className="size-3.5" /> Asked by an anonymous student · 2 min ago
              </p>
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-success/30 bg-success/5 p-3 text-sm">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-success">
                    <GraduationCap className="size-3.5" /> Dr. Anita Rao · Teacher
                  </p>
                  2NF removes partial dependencies on a composite key; 3NF removes transitive
                  dependencies between non-key columns.
                </div>
                <div className="rounded-xl border border-ai/30 bg-ai-soft p-3 text-sm">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-ai">
                    <Sparkles className="size-3.5" /> AI explanation · labelled
                  </p>
                  Think of 2NF as “depend on the whole key” and 3NF as “depend on nothing but the
                  key”…
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y bg-muted/40">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <h2 className="text-3xl font-bold">Why anonymous doubt-solving matters</h2>
          </div>
          <div className="grid gap-6 text-muted-foreground sm:grid-cols-2 lg:col-span-2">
            <p>
              Many students stay silent in class because they worry a question will sound “too
              basic” in front of peers or teachers. Those small gaps compound into real learning
              gaps.
            </p>
            <p>
              Removing the social cost of asking makes it safe to be curious. StudyAI keeps the
              internal link between a question and its author only for account security and
              moderation – it is never shown to other students.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <h2 className="text-center text-3xl font-bold">How StudyAI works</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
          Three steps from confusion to clarity.
        </p>
        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="relative rounded-2xl border bg-card p-6 transition-shadow hover:shadow-md"
            >
              <span className="absolute right-5 top-5 font-display text-4xl font-extrabold text-muted/80">
                {index + 1}
              </span>
              <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <step.icon className="size-5" aria-hidden />
              </div>
              <h3 className="text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 pb-16 sm:px-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-gradient-to-br from-ai-soft to-card p-8">
          <BrainCircuit className="mb-4 size-8 text-ai" aria-hidden />
          <h2 className="text-2xl font-bold">AI-powered categorisation</h2>
          <p className="mt-3 text-muted-foreground">
            When you write a question, Google Gemini suggests the most relevant subject and a topic
            label, with a confidence score. You stay in control – change the subject any time, and
            if AI is unavailable you simply pick one yourself.
          </p>
        </div>
        <div className="rounded-2xl border bg-gradient-to-br from-primary/10 to-card p-8">
          <ScanSearch className="mb-4 size-8 text-primary" aria-hidden />
          <h2 className="text-2xl font-bold">Privacy-conscious submission</h2>
          <p className="mt-3 text-muted-foreground">
            Before you post, StudyAI checks your text for things like names, roll numbers, phone
            numbers and emails, and warns you so you can edit them out. Automated checks help, but
            can’t catch everything – you always review before posting.
          </p>
        </div>
      </section>

      <section className="border-t bg-muted/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-center text-3xl font-bold">How students benefit</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map((b) => (
              <div key={b.title} className="rounded-2xl border bg-card p-6">
                <b.icon className="mb-3 size-6 text-primary" aria-hidden />
                <h3 className="font-semibold">{b.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{b.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-col items-center gap-4 rounded-2xl bg-primary px-6 py-10 text-center text-primary-foreground">
            <h2 className="text-2xl font-bold sm:text-3xl">Stop staying stuck.</h2>
            <p className="max-w-xl opacity-90">
              Join StudyAI with your college email and ask your first question in under a minute.
            </p>
            <Button asChild size="lg" variant="secondary">
              <Link to="/register">
                Create a free account <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
