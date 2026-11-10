import { and, count, eq } from 'drizzle-orm';
import type { AppConfig } from '../config/env.js';
import type { Database } from '../db/client.js';
import { questions } from '../db/schema.js';
import { userRepository } from '../repositories/user.repository.js';
import { toSelfUserDto } from '../serializers/index.js';
import type {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  UpdateProfileInput,
} from '../validators/auth.validators.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../utils/errors.js';
import type { TokenService } from '../utils/jwt.js';
import { getDummyHash, hashPassword, verifyPassword } from '../utils/password.js';

const INVALID_CREDENTIALS = 'Invalid email or password';

export class AuthService {
  constructor(
    private readonly db: Database,
    private readonly config: AppConfig,
    private readonly tokens: TokenService,
  ) {}

  private assertAllowedDomain(email: string) {
    const allowed = this.config.allowedEmailDomains;
    if (allowed.length === 0) return;
    const domain = email.split('@')[1] ?? '';
    const ok = allowed.some((d) => domain === d || domain.endsWith(`.${d}`));
    if (!ok) {
      throw new ValidationError(
        [{ path: 'email', message: `Use your college email address (${allowed.join(', ')})` }],
        'Email domain not allowed',
      );
    }
  }

  private async issueSession(userId: string) {
    const user = await userRepository.findAuthById(this.db, userId);
    if (!user) throw new NotFoundError('User');
    const token = this.tokens.sign({ sub: user.id, ver: user.tokenVersion, role: user.role });
    const profile = await userRepository.findSelfById(this.db, userId);
    return { token, user: toSelfUserDto(profile!) };
  }

  async register(input: RegisterInput) {
    this.assertAllowedDomain(input.email);

    if (await userRepository.existsByEmail(this.db, input.email)) {
      throw new ConflictError('An account with this email already exists', 'EMAIL_TAKEN');
    }
    if (input.rollNumber && (await userRepository.existsByRollNumber(this.db, input.rollNumber))) {
      throw new ConflictError('This roll number is already registered', 'ROLL_NUMBER_TAKEN');
    }

    const created = await userRepository.create(this.db, {
      email: input.email,
      passwordHash: await hashPassword(input.password),
      fullName: input.fullName,
      department: input.department,
      academicYear: input.academicYear,
      rollNumber: input.rollNumber ?? null,
      role: 'STUDENT',
    });
    return this.issueSession(created.id);
  }

  async login(input: LoginInput) {
    const user = await userRepository.findCredentialsByEmail(this.db, input.email);
    const valid = await verifyPassword(
      input.password,
      user?.passwordHash ?? (await getDummyHash()),
    );
    if (!user || !valid) throw new UnauthorizedError(INVALID_CREDENTIALS);
    if (!user.isActive)
      throw new ForbiddenError('This account has been suspended. Contact an administrator.');

    await userRepository.recordLogin(this.db, user.id);
    return this.issueSession(user.id);
  }

  async logout(userId: string) {
    await userRepository.bumpTokenVersion(this.db, userId);
  }

  async getProfile(userId: string) {
    const profile = await userRepository.findSelfById(this.db, userId);
    if (!profile) throw new NotFoundError('User');
    return toSelfUserDto(profile);
  }

  async updateProfile(userId: string, role: string, input: UpdateProfileInput) {
    if (input.academicYear !== undefined && role !== 'STUDENT') {
      throw new ValidationError([
        { path: 'academicYear', message: 'Academic year only applies to students' },
      ]);
    }
    await userRepository.update(this.db, userId, input);
    return this.getProfile(userId);
  }

  async changePassword(userId: string, input: ChangePasswordInput) {
    const hash = await userRepository.findPasswordHash(this.db, userId);
    if (!hash || !(await verifyPassword(input.currentPassword, hash))) {
      throw new ValidationError([
        { path: 'currentPassword', message: 'Current password is incorrect' },
      ]);
    }
    await userRepository.update(this.db, userId, {
      passwordHash: await hashPassword(input.newPassword),
    });
    await userRepository.bumpTokenVersion(this.db, userId);
    return this.issueSession(userId);
  }

  async getStudentStatistics(userId: string) {
    const rows = await this.db
      .select({ status: questions.status, value: count() })
      .from(questions)
      .where(and(eq(questions.authorId, userId)))
      .groupBy(questions.status);

    const byStatus = Object.fromEntries(rows.map((r) => [r.status, r.value])) as Record<
      string,
      number
    >;
    const total = rows.reduce((sum, r) => sum + r.value, 0);
    return {
      totalQuestions: total,
      open: byStatus.OPEN ?? 0,
      answered: byStatus.ANSWERED ?? 0,
      closed: byStatus.CLOSED ?? 0,
      flagged: byStatus.FLAGGED ?? 0,
    };
  }
}
