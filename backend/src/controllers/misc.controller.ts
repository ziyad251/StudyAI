import type { Request, Response } from 'express';
import { currentUser } from '../middleware/auth.js';
import type { Services } from '../services/index.js';
import { parseInput } from '../utils/validate.js';
import { paginationQuery } from '../utils/pagination.js';
import { z } from 'zod';

const paginationSchema = z.object(paginationQuery);
import { idParamSchema } from '../validators/common.validators.js';
import {
  askAiSchema,
  classifyQuestionSchema,
  listNotificationsQuerySchema,
  personalInfoCheckSchema,
  teacherQuestionsQuerySchema,
} from '../validators/misc.validators.js';
import { createReportSchema } from '../validators/report.validators.js';
import {
  createSubjectSchema,
  listSubjectsQuerySchema,
  updateSubjectSchema,
} from '../validators/subject.validators.js';

export function createSubjectController(services: Services) {
  return {
    async list(req: Request, res: Response) {
      const query = parseInput(listSubjectsQuerySchema, req.query);
      const includeInactive = Boolean(query.includeInactive) && req.user?.role === 'ADMIN';
      res.json({ items: await services.subjects.list({ includeInactive }) });
    },
    async create(req: Request, res: Response) {
      res
        .status(201)
        .json(await services.subjects.create(parseInput(createSubjectSchema, req.body)));
    },
    async update(req: Request, res: Response) {
      const { id } = parseInput(idParamSchema, req.params);
      res.json(await services.subjects.update(id, parseInput(updateSubjectSchema, req.body)));
    },
  };
}

export function createNotificationController(services: Services) {
  return {
    async list(req: Request, res: Response) {
      const { page, pageSize, unreadOnly } = parseInput(listNotificationsQuerySchema, req.query);
      res.json(
        await services.notifications.list(currentUser(req).id, { unreadOnly }, { page, pageSize }),
      );
    },
    async unreadCount(req: Request, res: Response) {
      res.json({ count: await services.notifications.unreadCount(currentUser(req).id) });
    },
    async markRead(req: Request, res: Response) {
      const { id } = parseInput(idParamSchema, req.params);
      res.json(await services.notifications.markRead(currentUser(req).id, id));
    },
    async markAllRead(req: Request, res: Response) {
      res.json(await services.notifications.markAllRead(currentUser(req).id));
    },
  };
}

export function createReportController(services: Services) {
  return {
    async create(req: Request, res: Response) {
      res
        .status(201)
        .json(
          await services.reports.create(currentUser(req), parseInput(createReportSchema, req.body)),
        );
    },
  };
}

export function createTeacherController(services: Services) {
  return {
    async subjects(req: Request, res: Response) {
      res.json({ items: await services.teacher.subjects(currentUser(req).id) });
    },
    async questions(req: Request, res: Response) {
      const query = parseInput(teacherQuestionsQuerySchema, req.query);
      res.json(await services.teacher.questions(currentUser(req), query));
    },
    async answers(req: Request, res: Response) {
      const { page, pageSize } = parseInput(paginationSchema, req.query);
      res.json(await services.teacher.answers(currentUser(req).id, { page, pageSize }));
    },
    async statistics(req: Request, res: Response) {
      res.json(await services.teacher.statistics(currentUser(req).id));
    },
  };
}

export function createAiController(services: Services) {
  return {
    status(_req: Request, res: Response) {
      res.json({ available: services.ai.isAvailable, model: services.ai.modelName });
    },
    async classify(req: Request, res: Response) {
      const { title, description } = parseInput(classifyQuestionSchema, req.body);
      res.json(await services.ai.classifyQuestion(`${title}\n\n${description}`.trim()));
    },
    async checkPersonalInformation(req: Request, res: Response) {
      const { text } = parseInput(personalInfoCheckSchema, req.body);
      res.json(await services.ai.checkPersonalInformation(text));
    },
    async ask(req: Request, res: Response) {
      const input = parseInput(askAiSchema, req.body);
      const user = currentUser(req);
      if ('questionId' in input) {
        res.json(await services.questions.explain(user, input.questionId));
        return;
      }
      let subjectName: string | null = null;
      if (input.subjectId) {
        const subjects = await services.subjects.list({ includeInactive: false });
        subjectName = subjects.find((s) => s.id === input.subjectId)?.name ?? null;
      }
      const content = await services.ai.explain({ text: input.prompt, subjectName });
      res.json({
        content,
        model: services.ai.modelName,
        generatedAt: new Date().toISOString(),
        cached: false,
        isAiGenerated: true,
        disclaimer:
          'AI-generated explanation. It may contain mistakes – verify with your teacher or course material.',
      });
    },
  };
}
