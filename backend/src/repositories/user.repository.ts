import { and, count, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { subjects, teacherSubjects, users, type NewUserRow, type UserRole } from '../db/schema.js';
import { escapeLike } from '../utils/text.js';
import { toOffset, type PageParams } from '../utils/pagination.js';

const selfColumns = {
  email: users.email,
  fullName: users.fullName,
  role: users.role,
  department: users.department,
  academicYear: users.academicYear,
  rollNumber: users.rollNumber,
  createdAt: users.createdAt,
};

const adminColumns = {
  id: users.id,
  ...selfColumns,
  isActive: users.isActive,
  lastLoginAt: users.lastLoginAt,
  updatedAt: users.updatedAt,
};

export const userRepository = {
  async findAuthById(db: Database, id: string) {
    const [row] = await db
      .select({
        id: users.id,
        role: users.role,
        fullName: users.fullName,
        isActive: users.isActive,
        tokenVersion: users.tokenVersion,
      })
      .from(users)
      .where(eq(users.id, id));
    return row;
  },

  async findCredentialsByEmail(db: Database, email: string) {
    const [row] = await db
      .select({
        id: users.id,
        role: users.role,
        passwordHash: users.passwordHash,
        isActive: users.isActive,
        tokenVersion: users.tokenVersion,
      })
      .from(users)
      .where(eq(users.email, email));
    return row;
  },

  async findPasswordHash(db: Database, id: string) {
    const [row] = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, id));
    return row?.passwordHash;
  },

  async findSelfById(db: Database, id: string) {
    const [row] = await db.select(selfColumns).from(users).where(eq(users.id, id));
    return row;
  },

  async existsByEmail(db: Database, email: string) {
    const [row] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    return Boolean(row);
  },

  async existsByRollNumber(db: Database, rollNumber: string) {
    const [row] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.rollNumber, rollNumber));
    return Boolean(row);
  },

  async create(db: Database, values: NewUserRow) {
    const [row] = await db
      .insert(users)
      .values(values)
      .returning({ id: users.id, role: users.role, tokenVersion: users.tokenVersion });
    return row!;
  },

  async update(db: Database, id: string, values: Partial<NewUserRow>) {
    const [row] = await db
      .update(users)
      .set(values)
      .where(eq(users.id, id))
      .returning({ id: users.id });
    return row;
  },

  async bumpTokenVersion(db: Database, id: string) {
    const [row] = await db
      .update(users)
      .set({ tokenVersion: sql`${users.tokenVersion} + 1` })
      .where(eq(users.id, id))
      .returning({ tokenVersion: users.tokenVersion });
    return row?.tokenVersion;
  },

  async recordLogin(db: Database, id: string) {
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, id));
  },

  async listForAdmin(
    db: Database,
    filters: { role?: UserRole; search?: string; isActive?: boolean },
    page: PageParams,
  ) {
    const conditions: SQL[] = [];
    if (filters.role) conditions.push(eq(users.role, filters.role));
    if (filters.isActive !== undefined) conditions.push(eq(users.isActive, filters.isActive));
    if (filters.search) {
      const pattern = `%${escapeLike(filters.search)}%`;
      conditions.push(
        or(
          ilike(users.fullName, pattern),
          ilike(users.email, pattern),
          ilike(users.department, pattern),
        )!,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;

    const [rows, [total]] = await Promise.all([
      db
        .select(adminColumns)
        .from(users)
        .where(where)
        .orderBy(desc(users.createdAt))
        .limit(page.pageSize)
        .offset(toOffset(page)),
      db.select({ value: count() }).from(users).where(where),
    ]);
    return { rows, total: total?.value ?? 0 };
  },

  async findForAdmin(db: Database, id: string) {
    const [row] = await db.select(adminColumns).from(users).where(eq(users.id, id));
    return row;
  },

  async listTeacherSubjects(db: Database, teacherId: string) {
    return db
      .select({
        id: subjects.id,
        name: subjects.name,
        code: subjects.code,
        category: subjects.category,
      })
      .from(teacherSubjects)
      .innerJoin(subjects, eq(subjects.id, teacherSubjects.subjectId))
      .where(eq(teacherSubjects.teacherId, teacherId))
      .orderBy(subjects.name);
  },

  async replaceTeacherSubjects(db: Database, teacherId: string, subjectIds: string[]) {
    await db.delete(teacherSubjects).where(eq(teacherSubjects.teacherId, teacherId));
    if (subjectIds.length) {
      await db
        .insert(teacherSubjects)
        .values(subjectIds.map((subjectId) => ({ teacherId, subjectId })));
    }
  },

  async countActiveAdmins(db: Database) {
    const [row] = await db
      .select({ value: count() })
      .from(users)
      .where(and(eq(users.role, 'ADMIN'), eq(users.isActive, true)));
    return row?.value ?? 0;
  },
};

export type SelfUserRecord = NonNullable<Awaited<ReturnType<typeof userRepository.findSelfById>>>;
export type AdminUserRecord = NonNullable<Awaited<ReturnType<typeof userRepository.findForAdmin>>>;
