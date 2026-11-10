import type { z } from 'zod';
import { ValidationError } from './errors.js';

export interface FieldIssue {
  path: string;
  message: string;
}

export function formatZodIssues(error: z.ZodError): FieldIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) throw new ValidationError(formatZodIssues(result.error));
  return result.data;
}
