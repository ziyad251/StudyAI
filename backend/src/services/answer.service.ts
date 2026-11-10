import type { Database } from '../db/client.js';
import type { AuthUser } from '../types/express.js';
import { answerRepository, commentRepository } from '../repositories/answer.repository.js';
import { questionRepository } from '../repositories/question.repository.js';
import { toPublicAnswerDto, toPublicCommentDto } from '../serializers/index.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors.js';
import { truncate } from '../utils/text.js';
import type { NotificationService } from './notification.service.js';
import { assertAcceptsActivity, loadVisibleQuestion } from './question-access.js';

export class AnswerService {
  constructor(
    private readonly db: Database,
    private readonly notifications: NotificationService,
  ) {}

  private async publicAnswer(id: string, viewerId: string) {
    const row = await answerRepository.findPublicById(this.db, id, viewerId);
    if (!row) throw new NotFoundError('Answer');
    return toPublicAnswerDto(row);
  }

  private async loadAnswer(user: AuthUser, answerId: string) {
    const answer = await answerRepository.findInternalById(this.db, answerId);
    if (!answer) throw new NotFoundError('Answer');
    const question = await loadVisibleQuestion(this.db, answer.questionId, user);
    return { answer, question };
  }

  async list(user: AuthUser, questionId: string) {
    await loadVisibleQuestion(this.db, questionId, user);
    const rows = await answerRepository.listPublicForQuestion(this.db, questionId, user.id);
    return rows.map(toPublicAnswerDto);
  }

  async create(user: AuthUser, questionId: string, content: string) {
    const question = await loadVisibleQuestion(this.db, questionId, user);
    assertAcceptsActivity(question.status);

    const created = await this.db.transaction(async (tx) => {
      const row = await answerRepository.insert(tx, { questionId, authorId: user.id, content });
      if (user.role === 'TEACHER') await questionRepository.refreshAnsweredStatus(tx, questionId);
      if (question.authorId !== user.id) {
        await this.notifications.notify(tx, {
          userId: question.authorId,
          type: 'NEW_ANSWER',
          title:
            user.role === 'TEACHER'
              ? 'A teacher answered your question'
              : 'New answer to your question',
          message: `"${truncate(question.title, 120)}" has a new answer.`,
          questionId,
        });
      }
      return row;
    });
    return this.publicAnswer(created.id, user.id);
  }

  async update(user: AuthUser, answerId: string, content: string) {
    const { answer, question } = await this.loadAnswer(user, answerId);
    if (answer.authorId !== user.id) throw new ForbiddenError('You can only edit your own answers');
    if (question.status === 'FLAGGED')
      throw new ForbiddenError('This question is under moderation review');
    await answerRepository.updateContent(this.db, answerId, content);
    return this.publicAnswer(answerId, user.id);
  }

  async delete(user: AuthUser, answerId: string) {
    const { answer } = await this.loadAnswer(user, answerId);
    if (answer.authorId !== user.id && user.role !== 'ADMIN') {
      throw new ForbiddenError('You can only delete your own answers');
    }
    await this.db.transaction(async (tx) => {
      await answerRepository.delete(tx, answerId);
      await questionRepository.refreshAnsweredStatus(tx, answer.questionId);
    });
  }

  async accept(user: AuthUser, answerId: string) {
    const { answer, question } = await this.loadAnswer(user, answerId);
    if (question.authorId !== user.id) {
      throw new ForbiddenError('Only the person who asked the question can accept an answer');
    }
    assertAcceptsActivity(question.status);
    if (answer.isAccepted) return this.publicAnswer(answerId, user.id);

    await this.db.transaction(async (tx) => {
      await answerRepository.accept(tx, question.id, answerId);
      await questionRepository.refreshAnsweredStatus(tx, question.id);
      if (answer.authorId !== user.id) {
        await this.notifications.notify(tx, {
          userId: answer.authorId,
          type: 'ANSWER_ACCEPTED',
          title: 'Your answer was accepted',
          message: `Your answer to "${truncate(question.title, 120)}" was marked as the accepted answer.`,
          questionId: question.id,
        });
      }
    });
    return this.publicAnswer(answerId, user.id);
  }

  async setUseful(user: AuthUser, answerId: string, useful: boolean) {
    const { answer, question } = await this.loadAnswer(user, answerId);
    if (answer.authorId === user.id)
      throw new BadRequestError('You cannot mark your own answer as useful');
    if (useful) {
      assertAcceptsActivity(question.status);
      await answerRepository.addVote(this.db, answerId, user.id);
    } else {
      await answerRepository.removeVote(this.db, answerId, user.id);
    }
    return this.publicAnswer(answerId, user.id);
  }

  async listComments(user: AuthUser, questionId: string) {
    await loadVisibleQuestion(this.db, questionId, user);
    const rows = await commentRepository.listPublicForQuestion(this.db, questionId, user.id);
    return rows.map(toPublicCommentDto);
  }

  async createComment(user: AuthUser, questionId: string, content: string) {
    const question = await loadVisibleQuestion(this.db, questionId, user);
    assertAcceptsActivity(question.status);

    const created = await this.db.transaction(async (tx) => {
      const row = await commentRepository.insert(tx, { questionId, authorId: user.id, content });
      if (question.authorId !== user.id) {
        await this.notifications.notify(tx, {
          userId: question.authorId,
          type: 'NEW_COMMENT',
          title: 'New comment on your question',
          message: `Someone commented on "${truncate(question.title, 120)}".`,
          questionId,
        });
      }
      return row;
    });
    const row = await commentRepository.findPublicById(this.db, created.id, user.id);
    return toPublicCommentDto(row!);
  }

  async deleteComment(user: AuthUser, commentId: string) {
    const comment = await commentRepository.findInternalById(this.db, commentId);
    if (!comment) throw new NotFoundError('Comment');
    await loadVisibleQuestion(this.db, comment.questionId, user);
    if (comment.authorId !== user.id && user.role !== 'ADMIN') {
      throw new ForbiddenError('You can only delete your own comments');
    }
    await commentRepository.delete(this.db, commentId);
  }
}
