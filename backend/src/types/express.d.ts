import type { UserRole } from '../db/schema.js';

export interface AuthUser {
  id: string;
  role: UserRole;
  fullName: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
