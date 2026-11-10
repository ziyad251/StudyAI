import type { Request, Response } from 'express';
import type { AppConfig } from '../config/env.js';
import { currentUser } from '../middleware/auth.js';
import type { Services } from '../services/index.js';
import { clearSessionCookie, setSessionCookie } from '../utils/session-cookie.js';
import { parseInput } from '../utils/validate.js';
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
} from '../validators/auth.validators.js';

export function createAuthController(services: Services, config: AppConfig) {
  return {
    async register(req: Request, res: Response) {
      const input = parseInput(registerSchema, req.body);
      const { token, user } = await services.auth.register(input);
      setSessionCookie(res, config, token);
      res.status(201).json({ user });
    },

    async login(req: Request, res: Response) {
      const input = parseInput(loginSchema, req.body);
      const { token, user } = await services.auth.login(input);
      setSessionCookie(res, config, token);
      res.json({ user });
    },

    async logout(req: Request, res: Response) {
      if (req.user) await services.auth.logout(req.user.id);
      clearSessionCookie(res, config);
      res.status(204).end();
    },

    async me(req: Request, res: Response) {
      res.json({ user: await services.auth.getProfile(currentUser(req).id) });
    },

    async updateProfile(req: Request, res: Response) {
      const user = currentUser(req);
      const input = parseInput(updateProfileSchema, req.body);
      res.json({ user: await services.auth.updateProfile(user.id, user.role, input) });
    },

    async changePassword(req: Request, res: Response) {
      const input = parseInput(changePasswordSchema, req.body);
      const { token, user } = await services.auth.changePassword(currentUser(req).id, input);
      setSessionCookie(res, config, token);
      res.json({ user });
    },

    async myStatistics(req: Request, res: Response) {
      res.json(await services.auth.getStudentStatistics(currentUser(req).id));
    },
  };
}
