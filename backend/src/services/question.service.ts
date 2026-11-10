import { and, eq } from 'drizzle-orm';
import type { AppConfig } from '../config/env.js';
import type { Database } from '../db/client.js';
import { subjects } from '../db/schema.js';
import type { AuthUser } from '../types/express.js';
import { questionRepository } from '../repositories/question.repository.js';
import { toAiExplanationDto, toPublicQuestionDto } from '../serializers/index.js';
import type {
  CreateQuestionInput,
  ListQuestionsQuery,
  UpdateQuestionInput,
} from '../validators/question.validators.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnprocessableError,
  ValidationError,
} from '../utils/errors.js';
import { paginate } from '../utils/pagination.js';
import { normaliseWhitespace } from '../utils/text.js';
import type { AiService } from './ai/ai.service.js';
import { detectPersonalInformation } from './ai/pii-detector.js';
import type { NotificationService } from './notification.service.js';
import { loadVisibleQuestion, toViewer } from './question-access.js';

export class QuestionService {
  constructor(
    private readonly db: Database,
    private readonly config: AppConfig,
    private readonly ai: AiService,
    private readonly notifications: NotificationService,
  ) {}

  private async assertActiveSubject(subjectId: string) {
    const [subject] = await this.db
      .select({ id: subjects.id })
      .from(subjects)
      .where(and(eq(subjects.id, subjectId), eq(subjects.isActive, true)));
    if (!subject) throw new ValidationError([{ path: 'subjectId', message: 'Subject not found' }]);
  }

  private assertNoUnacknowledgedPii(text: string, acknowledged: boolean) {
    if (acknowledged) return;
    const findings = detectPersonalInformation(text);
    if (findings.length) {
      throw new UnprocessableError(
        'Your question may contain personal information. Please review it before submitting.',
        'PERSONAL_INFO_WARNING',
        { findings },
      );
    }
  }

  async getById(user: AuthUser | undefined, id: string) {
    const row = await questionRepository.findPublicById(this.db, id, toViewer(user));
    if (!row) throw new NotFoundError('Question');
    return toPublicQuestionDto(row);
  }

  async list(user: AuthUser | undefined, query: ListQuestionsQuery) {
    const { page, pageSize, ...filters } = query;
    const { rows, total } = await questionRepository.listPublic(this.db, filters, toViewer(user), {
      page,
      pageSize,
    });
    return paginate(rows.map(toPublicQuestionDto), total, { page, pageSize });
  }

  async create(user: AuthUser, input: CreateQuestionInput) {
    const title = normaliseWhitespace(input.title);
    const description = normaliseWhitespace(input.description);
    this.assertNoUnacknowledgedPii(`${title}\n${description}`, input.acknowledgePersonalInfo);

    const classification = await this.ai.tryClassifyQuestion(`${title}\n\n${description}`);

    let subjectId = input.subjectId;
    if (subjectId) {
      await this.assertActiveSubject(subjectId);
    } else if (
      classification &&
      classification.confidence >= this.config.ai.classificationMinConfidence
    ) {
      subjectId = classification.subjectId;
    } else {
      throw new UnprocessableError(
        this.ai.isAvailable
          ? 'We could not confidently determine the subject. Please choose one.'
          : 'Please choose a subject for your question.',
        'SUBJECT_REQUIRED',
        classification ? { suggestion: classification } : undefined,
      );
    }

    const created = await this.db.transaction(async (tx) => {
      const row = await questionRepository.insert(tx, {
        authorId: user.id,
        subjectId: subjectId!,
        title,
        description,
        aiCategory: classification?.category ?? null,
        aiConfidence: classification?.confidence ?? null,
        aiSubjectId: classification?.subjectId ?? null,
      });
      await this.notifications.notifySubjectTeachers(tx, subjectId!, { id: row.id, title });
      return row;
    });

    return this.getById(user, created.id);
  }

  async update(user: AuthUser, id: string, input: UpdateQuestionInput) {
    const question = await loadVisibleQuestion(this.db, id, user);
    if (question.authorId !== user.id)
      throw new ForbiddenError('You can only edit your own questions');
    if (question.status === 'FLAGGED') {
      throw new ForbiddenError('This question is under moderation review and cannot be edited');
    }

    const contentChanged = input.title !== undefined || input.description !== undefined;
    if (
      question.status === 'CLOSED' &&
      (contentChanged || input.subjectId) &&
      input.status !== 'OPEN'
    ) {
      throw new ConflictError('Reopen the question before editing it', 'QUESTION_LOCKED');
    }

    const title = input.title !== undefined ? normaliseWhitespace(input.title) : question.title;
    const description =
      input.description !== undefined
        ? normaliseWhitespace(input.description)
        : question.description;
    if (contentChanged)
      this.assertNoUnacknowledgedPii(`${title}\n${description}`, input.acknowledgePersonalInfo);
    if (input.subjectId) await this.assertActiveSubject(input.subjectId);

    const changes: Parameters<typeof questionRepository.update>[2] = {};
    if (input.title !== undefined) changes.title = title;
    if (input.description !== undefined) changes.description = description;
    if (input.subjectId) changes.subjectId = input.subjectId;

    if (contentChanged) {
      const classification = await this.ai.tryClassifyQuestion(`${title}\n\n${description}`);
      if (classification) {
        changes.aiCategory = classification.category;
        changes.aiConfidence = classification.confidence;
        changes.aiSubjectId = classification.subjectId;
      }
    }

    await this.db.transaction(async (tx) => {
      if (input.status === 'CLOSED') changes.status = 'CLOSED';
      if (input.status === 'OPEN' && question.status === 'CLOSED') {
        changes.status = await questionRepository.resolveActiveStatus(tx, id);
      }
      if (Object.keys(changes).length) await questionRepository.update(tx, id, changes);
      if (contentChanged) await questionRepository.clearExplanation(tx, id);
    });

    return this.getById(user, id);
  }

  async delete(user: AuthUser, id: string) {
    const question = await loadVisibleQuestion(this.db, id, user);
    const isAdmin = user.role === 'ADMIN';
    if (!isAdmin && question.authorId !== user.id) {
      throw new ForbiddenError('You can only delete your own questions');
    }
    if (!isAdmin && (await questionRepository.countAnswers(this.db, id)) > 0) {
      throw new ConflictError(
        'Questions that have answers cannot be deleted. Close the question instead.',
        'QUESTION_HAS_ANSWERS',
      );
    }
    await questionRepository.delete(this.db, id);
  }

  async explain(user: AuthUser, id: string) {
    const question = await loadVisibleQuestion(this.db, id, user);
    const cached = await questionRepository.findCachedExplanation(this.db, id);
    if (cached) return toAiExplanationDto(cached, true);

    const [subject] = await this.db
      .select({ name: subjects.name })
      .from(subjects)
      .where(eq(subjects.id, question.subjectId));
    const content = await this.ai.explain({
      title: question.title,
      text: question.description,
      subjectName: subject?.name ?? null,
    });
    const saved = await questionRepository.saveExplanation(this.db, {
      questionId: id,
      content,
      model: this.ai.modelName ?? 'unknown',
    });
    return toAiExplanationDto(saved, false);
  }
}
