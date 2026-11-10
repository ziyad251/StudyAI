import { z } from 'zod';
import { text } from './common.validators.js';

export const answerBodySchema = z.strictObject({
  content: text(10, 10_000, 'Answer'),
});

export const commentBodySchema = z.strictObject({
  content: text(2, 1000, 'Comment'),
});

export type AnswerBody = z.infer<typeof answerBodySchema>;
export type CommentBody = z.infer<typeof commentBodySchema>;
