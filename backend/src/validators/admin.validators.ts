import { z } from 'zod';
import { QUESTION_STATUSES, USER_ROLES } from '../db/schema.js';
import { paginationQuery } from '../utils/pagination.js';
import {
  academicYearSchema,
  emailSchema,
  passwordSchema,
  queryBoolean,
  rollNumberSchema,
  text,
} from './common.validators.js';

export const listUsersQuerySchema = z.object({
  ...paginationQuery,
  role: z.enum(USER_ROLES).optional(),
  search: z.string().trim().max(120).optional(),
  isActive: queryBoolean.optional(),
});

export const createUserSchema = z
  .strictObject({
    fullName: text(2, 120, 'Full name'),
    email: emailSchema,
    password: passwordSchema,
    role: z.enum(USER_ROLES),
    department: text(2, 120, 'Department'),
    academicYear: academicYearSchema.optional(),
    rollNumber: rollNumberSchema,
    subjectIds: z.array(z.uuid()).max(50).optional(),
  })
  .refine((data) => data.role === 'STUDENT' || data.academicYear === undefined, {
    path: ['academicYear'],
    message: 'Academic year only applies to students',
  });

export const updateUserSchema = z
  .strictObject({
    fullName: text(2, 120, 'Full name').optional(),
    department: text(2, 120, 'Department').optional(),
    role: z.enum(USER_ROLES).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, 'Provide at least one field to update');

export const setTeacherSubjectsSchema = z.strictObject({
  subjectIds: z.array(z.uuid()).max(50),
});

export const moderationQueueQuerySchema = z.object({
  ...paginationQuery,
  status: z.enum(QUESTION_STATUSES).optional(),
  reportedOnly: queryBoolean.optional(),
  search: z.string().trim().max(200).optional(),
});

export const moderateQuestionSchema = z.strictObject({
  action: z.enum(['FLAG', 'RESTORE', 'CLOSE', 'DELETE']),
  note: z.string().trim().max(1000).optional(),
  suspendAuthor: z.boolean().optional().default(false),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ModerationQueueQuery = z.infer<typeof moderationQueueQuerySchema>;
export type ModerateQuestionInput = z.infer<typeof moderateQuestionSchema>;
