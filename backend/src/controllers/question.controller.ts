import type { Request, Response } from 'express';
import { currentUser } from '../middleware/auth.js';
import type { Services } from '../services/index.js';
import { parseInput } from '../utils/validate.js';
import { answerBodySchema, commentBodySchema } from '../validators/answer.validators.js';
import { idParamSchema } from '../validators/common.validators.js';
import {
  createQuestionSchema,
  listQuestionsQuerySchema,
  updateQuestionSchema,
} from '../validators/question.validators.js';

export function createQuestionController(services: Services) {
  return {
    async list(req: Request, res: Response) {
      const query = parseInput(listQuestionsQuerySchema, req.query);
      res.json(await services.questions.list(req.user, query));
    },

    async get(req: Request, res: Response) {
      const { id } = parseInput(idParamSchema, req.params);
      res.json(await services.questions.getById(req.user, id));
    },

    async create(req: Request, res: Response) {
      const input = parseInput(createQuestionSchema, req.body);
      res.status(201).json(await services.questions.create(currentUser(req), input));
    },

    async update(req: Request, res: Response) {
      const { id } = parseInput(idParamSchema, req.params);
      const input = parseInput(updateQuestionSchema, req.body);
      res.json(await services.questions.update(currentUser(req), id, input));
    },

    async remove(req: Request, res: Response) {
      const { id } = parseInput(idParamSchema, req.params);
      await services.questions.delete(currentUser(req), id);
      res.status(204).end();
    },

    async listAnswers(req: Request, res: Response) {
      const { id } = parseInput(idParamSchema, req.params);
      res.json({ items: await services.answers.list(currentUser(req), id) });
    },

    async createAnswer(req: Request, res: Response) {
      const { id } = parseInput(idParamSchema, req.params);
      const { content } = parseInput(answerBodySchema, req.body);
      res.status(201).json(await services.answers.create(currentUser(req), id, content));
    },

    async listComments(req: Request, res: Response) {
      const { id } = parseInput(idParamSchema, req.params);
      res.json({ items: await services.answers.listComments(currentUser(req), id) });
    },

    async createComment(req: Request, res: Response) {
      const { id } = parseInput(idParamSchema, req.params);
      const { content } = parseInput(commentBodySchema, req.body);
      res.status(201).json(await services.answers.createComment(currentUser(req), id, content));
    },
  };
}

export function createAnswerController(services: Services) {
  return {
    async update(req: Request, res: Response) {
      const { id } = parseInput(idParamSchema, req.params);
      const { content } = parseInput(answerBodySchema, req.body);
      res.json(await services.answers.update(currentUser(req), id, content));
    },

    async remove(req: Request, res: Response) {
      const { id } = parseInput(idParamSchema, req.params);
      await services.answers.delete(currentUser(req), id);
      res.status(204).end();
    },

    async accept(req: Request, res: Response) {
      const { id } = parseInput(idParamSchema, req.params);
      res.json(await services.answers.accept(currentUser(req), id));
    },

    async markUseful(req: Request, res: Response) {
      const { id } = parseInput(idParamSchema, req.params);
      res.json(await services.answers.setUseful(currentUser(req), id, true));
    },

    async unmarkUseful(req: Request, res: Response) {
      const { id } = parseInput(idParamSchema, req.params);
      res.json(await services.answers.setUseful(currentUser(req), id, false));
    },

    async removeComment(req: Request, res: Response) {
      const { id } = parseInput(idParamSchema, req.params);
      await services.answers.deleteComment(currentUser(req), id);
      res.status(204).end();
    },
  };
}
