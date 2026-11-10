import type { Request, Response } from 'express';
import { currentUser } from '../middleware/auth.js';
import type { Services } from '../services/index.js';
import { parseInput } from '../utils/validate.js';
import {
  createUserSchema,
  listUsersQuerySchema,
  moderateQuestionSchema,
  moderationQueueQuerySchema,
  setTeacherSubjectsSchema,
  updateUserSchema,
} from '../validators/admin.validators.js';
import { idParamSchema } from '../validators/common.validators.js';
import { listReportsQuerySchema, resolveReportSchema } from '../validators/report.validators.js';

export function createAdminController(services: Services) {
  return {
    async listUsers(req: Request, res: Response) {
      res.json(await services.admin.listUsers(parseInput(listUsersQuerySchema, req.query)));
    },
    async getUser(req: Request, res: Response) {
      const { id } = parseInput(idParamSchema, req.params);
      res.json(await services.admin.getUser(id));
    },
    async createUser(req: Request, res: Response) {
      res.status(201).json(await services.admin.createUser(parseInput(createUserSchema, req.body)));
    },
    async updateUser(req: Request, res: Response) {
      const { id } = parseInput(idParamSchema, req.params);
      res.json(
        await services.admin.updateUser(
          currentUser(req),
          id,
          parseInput(updateUserSchema, req.body),
        ),
      );
    },
    async setTeacherSubjects(req: Request, res: Response) {
      const { id } = parseInput(idParamSchema, req.params);
      const { subjectIds } = parseInput(setTeacherSubjectsSchema, req.body);
      res.json(await services.admin.setTeacherSubjects(id, subjectIds));
    },
    async statistics(_req: Request, res: Response) {
      res.json(await services.admin.statistics());
    },
    async moderationQueue(req: Request, res: Response) {
      res.json(
        await services.admin.moderationQueue(parseInput(moderationQueueQuerySchema, req.query)),
      );
    },
    async moderateQuestion(req: Request, res: Response) {
      const { id } = parseInput(idParamSchema, req.params);
      const input = parseInput(moderateQuestionSchema, req.body);
      res.json(await services.admin.moderateQuestion(currentUser(req), id, input));
    },
    async listReports(req: Request, res: Response) {
      res.json(await services.reports.list(parseInput(listReportsQuerySchema, req.query)));
    },
    async resolveReport(req: Request, res: Response) {
      const { id } = parseInput(idParamSchema, req.params);
      res.json(
        await services.reports.resolve(
          currentUser(req),
          id,
          parseInput(resolveReportSchema, req.body),
        ),
      );
    },
  };
}
