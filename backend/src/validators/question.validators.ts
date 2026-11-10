import { z } from 'zod';
import { QUESTION_STATUSES } from '../db/schema.js';
import { paginationQuery } from '../utils/pagination.js';
import { queryBoolean, text } from './common.validators.js';

export const QUESTION_TITLE = { min: 10, max: 200 } as const;
export const QUESTION_DESCRIPTION = { min: 20, max: 5000 } as const;

export const createQuestionSchema = z.strictObject({
  title: text(QUESTION_TITLE.min, QUESTION_TITLE.max, 'Title'),
  description: text(QUESTION_DESCRIPTION.min, QUESTION_DESCRIPTION.max, 'Description'),
  subjectId: z.uuid({ message: 'Invalid subject' }).optional(),
  acknowledgePersonalInfo: z.boolean().optional().default(false),
});

export const updateQuestionSchema = z
  .strictObject({
    title: text(QUESTION_TITLE.min, QUESTION_TITLE.max, 'Title').optional(),
    description: text(QUESTION_DESCRIPTION.min, QUESTION_DESCRIPTION.max, 'Description').optional(),
    subjectId: z.uuid({ message: 'Invalid subject' }).optional(),
    status: z.enum(['OPEN', 'CLOSED']).optional(),
    acknowledgePersonalInfo: z.boolean().optional().default(false),
  })
  .refine(
    ({ acknowledgePersonalInfo: _ack, ...rest }) =>
      Object.values(rest).some((v) => v !== undefined),
    'Provide at least one field to update',
  );

export const listQuestionsQuerySchema = z.object({
  ...paginationQuery,
  search: z.string().trim().max(200).optional(),
  subjectId: z.uuid().optional(),
  status: z.enum(QUESTION_STATUSES).optional(),
  mine: queryBoolean.optional(),
  unanswered: queryBoolean.optional(),
  sort: z.enum(['newest', 'oldest', 'most_answered']).default('newest'),
});

export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;
export type ListQuestionsQuery = z.infer<typeof listQuestionsQuerySchema>;
