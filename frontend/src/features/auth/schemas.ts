import { z } from 'zod';

export const passwordRules = [
  { test: (v: string) => v.length >= 10, label: 'At least 10 characters' },
  {
    test: (v: string) => /[a-z]/.test(v) && /[A-Z]/.test(v),
    label: 'Upper- and lowercase letters',
  },
  { test: (v: string) => /\d/.test(v), label: 'A number' },
  { test: (v: string) => /[^A-Za-z0-9]/.test(v), label: 'A symbol' },
];

export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(72, 'Password must be at most 72 characters')
  .refine((v) => /[a-z]/.test(v), 'Password must contain a lowercase letter')
  .refine((v) => /[A-Z]/.test(v), 'Password must contain an uppercase letter')
  .refine((v) => /\d/.test(v), 'Password must contain a number')
  .refine((v) => /[^A-Za-z0-9]/.test(v), 'Password must contain a symbol');

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').pipe(z.email('Enter a valid email address')),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(120),
    email: z
      .string()
      .trim()
      .min(1, 'Email is required')
      .pipe(z.email('Enter a valid email address')),
    department: z.string().trim().min(2, 'Department is required').max(120),
    academicYear: z.string().regex(/^[1-6]$/, 'Select your academic year'),
    rollNumber: z
      .string()
      .trim()
      .max(40)
      .regex(/^[A-Za-z0-9/_-]*$/, 'Only letters, numbers, "/", "_" and "-"')
      .optional(),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })
  .refine(
    (d) => !d.password.toLowerCase().includes(d.email.split('@')[0]?.toLowerCase() || '\u0000'),
    {
      path: ['password'],
      message: 'Password must not contain your email name',
    },
  );

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;

export const QUESTION_LIMITS = {
  titleMin: 10,
  titleMax: 200,
  descriptionMin: 20,
  descriptionMax: 5000,
};

export const questionSchema = z.object({
  title: z
    .string()
    .trim()
    .min(QUESTION_LIMITS.titleMin, `Title must be at least ${QUESTION_LIMITS.titleMin} characters`)
    .max(QUESTION_LIMITS.titleMax, `Title must be at most ${QUESTION_LIMITS.titleMax} characters`),
  description: z
    .string()
    .trim()
    .min(
      QUESTION_LIMITS.descriptionMin,
      `Description must be at least ${QUESTION_LIMITS.descriptionMin} characters`,
    )
    .max(
      QUESTION_LIMITS.descriptionMax,
      `Description must be at most ${QUESTION_LIMITS.descriptionMax} characters`,
    ),
  subjectId: z.string().optional(),
});

export type QuestionValues = z.infer<typeof questionSchema>;
