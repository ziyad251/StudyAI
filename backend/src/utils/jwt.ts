import jwt from 'jsonwebtoken';
import type { UserRole } from '../db/schema.js';

const ISSUER = 'studyai-api';
const AUDIENCE = 'studyai-web';
const ALGORITHM = 'HS256';

export interface SessionClaims {
  sub: string;
  ver: number;
  role: UserRole;
}

export class TokenService {
  constructor(
    private readonly secret: string,
    readonly expiresInSeconds: number,
  ) {}

  sign(claims: SessionClaims): string {
    return jwt.sign({ ver: claims.ver, role: claims.role }, this.secret, {
      subject: claims.sub,
      algorithm: ALGORITHM,
      issuer: ISSUER,
      audience: AUDIENCE,
      expiresIn: this.expiresInSeconds,
    });
  }

  verify(token: string): SessionClaims | null {
    try {
      const payload = jwt.verify(token, this.secret, {
        algorithms: [ALGORITHM],
        issuer: ISSUER,
        audience: AUDIENCE,
      });
      if (typeof payload === 'string' || typeof payload.sub !== 'string') return null;
      if (typeof payload.ver !== 'number' || typeof payload.role !== 'string') return null;
      return { sub: payload.sub, ver: payload.ver, role: payload.role as UserRole };
    } catch {
      return null;
    }
  }
}
