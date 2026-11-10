import { z } from 'zod';

export const idParamSchema = z.object({ id: z.uuid({ message: 'Invalid identifier' }) });

export const text = (min: number, max: number, label: string) =>
  z
    .string({ message: `${label} is required` })
    .trim()
    .min(min, `${label} must be at least ${min} characters`)
    .max(max, `${label} must be at most ${max} characters`);

export const queryBoolean = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

export const emailSchema = z
  .string({ message: 'Email is required' })
  .trim()
  .toLowerCase()
  .max(255)
  .pipe(z.email({ message: 'Enter a valid email address' }));

export const passwordSchema = z
  .string({ message: 'Password is required' })
  .min(10, 'Password must be at least 10 characters')
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be at most 72 bytes')
  .refine((value) => /[a-z]/.test(value), 'Password must contain a lowercase letter')
  .refine((value) => /[A-Z]/.test(value), 'Password must contain an uppercase letter')
  .refine((value) => /\d/.test(value), 'Password must contain a number')
  .refine((value) => /[^A-Za-z0-9]/.test(value), 'Password must contain a symbol');

export const academicYearSchema = z.coerce
  .number({ message: 'Academic year must be a number' })
  .int()
  .min(1, 'Academic year must be between 1 and 6')
  .max(6, 'Academic year must be between 1 and 6');

export const rollNumberSchema = z
  .string()
  .trim()
  .max(40, 'Roll number must be at most 40 characters')
  .regex(/^[A-Za-z0-9/_-]*$/, 'Roll number may only contain letters, numbers, "/", "_" and "-"')
  .transform((value) => (value === '' ? undefined : value.toUpperCase()))
  .optional();
