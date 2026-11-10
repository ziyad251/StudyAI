import type { Database } from '../db/client.js';
import type { QuestionStatus } from '../db/schema.js';
import type { AuthUser } from '../types/express.js';
import { questionRepository, type QuestionViewer } from '../repositories/question.repository.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';

export function toViewer(user: AuthUser | undefined): QuestionViewer {
  return { id: user?.id ?? null, canSeeFlagged: user?.role === 'ADMIN' };
}

export async function loadVisibleQuestion(
  db: Database,
  questionId: string,
  user: AuthUser | undefined,
) {
  const question = await questionRepository.findInternalById(db, questionId);
  if (!question) throw new NotFoundError('Question');
  const viewer = toViewer(user);
  if (question.status === 'FLAGGED' && !viewer.canSeeFlagged && question.authorId !== viewer.id) {
    throw new NotFoundError('Question');
  }
  return question;
}

const LOCKED: QuestionStatus[] = ['CLOSED', 'FLAGGED'];

export function assertAcceptsActivity(status: QuestionStatus) {
  if (LOCKED.includes(status)) {
    throw new ConflictError(
      status === 'CLOSED' ? 'This question is closed' : 'This question is under moderation review',
      'QUESTION_LOCKED',
    );
  }
}
