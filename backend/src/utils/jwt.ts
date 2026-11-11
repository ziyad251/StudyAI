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

export type VerifyResult =
  | { status: 'valid'; claims: SessionClaims; expiresAt: number }
  | { status: 'expired' }
  | { status: 'invalid' };

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

  /**
   * Sliding sessions: once less than half of the lifetime remains, an active user should be handed
   * a fresh token so they are not signed out mid-semester, while idle sessions still expire.
   */
  shouldRenew(expiresAt: number, now = Date.now()): boolean {
    return expiresAt * 1000 - now < (this.expiresInSeconds * 1000) / 2;
  }

  verify(token: string): SessionClaims | null {
    const result = this.inspect(token);
    return result.status === 'valid' ? result.claims : null;
  }

  /**
   * Like {@link verify} but tells an expired-yet-authentic token apart from one that is malformed,
   * forged or signed with an unknown key. Expiry is only reported once the signature checks out.
   */
  inspect(token: string): VerifyResult {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded) return { status: 'invalid' };

    // Tokens issued before key ids were introduced carry no `kid`; try every known key.
    const kid = decoded.header.kid;
    const candidates = kid ? [this.keys.get(kid)].filter(Boolean) : [...this.keys.values()];

    for (const key of candidates as SigningKey[]) {
      const result = this.verifyWith(token, key.secret);
      if (result.status !== 'invalid') return result;
    }
    return { status: 'invalid' };
  }

  private verifyWith(token: string, secret: string): VerifyResult {
    try {
      const payload = jwt.verify(token, secret, {
        algorithms: [ALGORITHM],
        issuer: ISSUER,
        audience: AUDIENCE,
      });
      if (typeof payload === 'string' || typeof payload.sub !== 'string') {
        return { status: 'invalid' };
      }
      if (typeof payload.ver !== 'number' || typeof payload.role !== 'string') {
        return { status: 'invalid' };
      }
      if (typeof payload.exp !== 'number') return { status: 'invalid' };
      return {
        status: 'valid',
        claims: { sub: payload.sub, ver: payload.ver, role: payload.role as UserRole },
        expiresAt: payload.exp,
      };
    } catch (error) {
      // jsonwebtoken checks the signature before expiry, so this only fires for authentic tokens.
      if (error instanceof jwt.TokenExpiredError) return { status: 'expired' };
      return { status: 'invalid' };
    }
  }
}
