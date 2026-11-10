import { z } from 'zod';
import { queryBoolean, text } from './common.validators.js';

const code = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9-]{2,20}$/, 'Code must be 2–20 letters, digits or hyphens');

export const createSubjectSchema = z.strictObject({
  name: text(3, 120, 'Name'),
  code,
  category: text(2, 80, 'Category'),
  description: z.string().trim().max(500).optional(),
});

export const updateSubjectSchema = z
  .strictObject({
    name: text(3, 120, 'Name').optional(),
    code: code.optional(),
    category: text(2, 80, 'Category').optional(),
    description: z.string().trim().max(500).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, 'Provide at least one field to update');

export const listSubjectsQuerySchema = z.object({
  includeInactive: queryBoolean.optional(),
});

export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;
export type UpdateSubjectInput = z.infer<typeof updateSubjectSchema>;
