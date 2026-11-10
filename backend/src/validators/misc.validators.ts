import { z } from 'zod';
import { paginationQuery } from '../utils/pagination.js';
import { queryBoolean, text } from './common.validators.js';
import { QUESTION_DESCRIPTION, QUESTION_TITLE } from './question.validators.js';

export const listNotificationsQuerySchema = z.object({
  ...paginationQuery,
  unreadOnly: queryBoolean.optional(),
});

export const teacherQuestionsQuerySchema = z.object({
  ...paginationQuery,
  subjectId: z.uuid().optional(),
  status: z.enum(['OPEN', 'ANSWERED', 'CLOSED']).optional(),
  unanswered: queryBoolean.optional(),
  search: z.string().trim().max(200).optional(),
});

export const classifyQuestionSchema = z
  .strictObject({
    title: z.string().trim().max(QUESTION_TITLE.max).default(''),
    description: z.string().trim().max(QUESTION_DESCRIPTION.max).default(''),
  })
  .refine((d) => `${d.title} ${d.description}`.trim().length >= 10, {
    message: 'Provide at least 10 characters of question text to classify',
  });

export const personalInfoCheckSchema = z.strictObject({
  text: text(1, QUESTION_TITLE.max + QUESTION_DESCRIPTION.max + 10, 'Text'),
});

export const askAiSchema = z.union([
  z.strictObject({ questionId: z.uuid() }),
  z.strictObject({
    prompt: text(10, 2000, 'Question'),
    subjectId: z.uuid().optional(),
  }),
]);

export type AskAiInput = z.infer<typeof askAiSchema>;
