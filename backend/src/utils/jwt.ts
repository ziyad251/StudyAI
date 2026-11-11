import { createHash } from 'node:crypto';
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

interface SigningKey {
  kid: string;
  secret: string;
}

/** Stable, non-reversible identifier for a secret so tokens can name the key that signed them. */
function keyId(secret: string): string {
  return createHash('sha256').update(secret).digest('base64url').slice(0, 12);
}

export class TokenService {
  private readonly current: SigningKey;
  private readonly keys: Map<string, SigningKey>;

  /**
   * @param secret            the active signing secret
   * @param expiresInSeconds  session lifetime
   * @param previousSecrets   retired secrets that are still accepted for verification, so that
   *                          rotating JWT_SECRET does not log every user out at once
   */
  constructor(
    secret: string,
    readonly expiresInSeconds: number,
    previousSecrets: readonly string[] = [],
  ) {
    this.current = { kid: keyId(secret), secret };
    this.keys = new Map([[this.current.kid, this.current]]);
    for (const previous of previousSecrets) {
      const key = { kid: keyId(previous), secret: previous };
      if (!this.keys.has(key.kid)) this.keys.set(key.kid, key);
    }
  }

  sign(claims: SessionClaims): string {
    return jwt.sign({ ver: claims.ver, role: claims.role }, this.current.secret, {
      subject: claims.sub,
      algorithm: ALGORITHM,
      issuer: ISSUER,
      audience: AUDIENCE,
      expiresIn: this.expiresInSeconds,
      keyid: this.current.kid,
    });
  }

  verify(token: string): SessionClaims | null {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded) return null;

    // Tokens issued before key ids were introduced carry no `kid`; try every known key.
    const kid = decoded.header.kid;
    const candidates = kid ? [this.keys.get(kid)].filter(Boolean) : [...this.keys.values()];

    for (const key of candidates as SigningKey[]) {
      const claims = this.verifyWith(token, key.secret);
      if (claims) return claims;
    }
    return null;
  }

  private verifyWith(token: string, secret: string): SessionClaims | null {
    try {
      const payload = jwt.verify(token, secret, {
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
