import { asc, eq, sql } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { questions, subjects, teacherSubjects } from '../db/schema.js';
import { toSubjectDto } from '../serializers/index.js';
import type { CreateSubjectInput, UpdateSubjectInput } from '../validators/subject.validators.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';

export class SubjectService {
  constructor(private readonly db: Database) {}

  async list(options: { includeInactive: boolean }) {
    const rows = await this.db
      .select({
        id: subjects.id,
        name: subjects.name,
        code: subjects.code,
        category: subjects.category,
        description: subjects.description,
        isActive: subjects.isActive,
        questionCount: sql<number>`(SELECT count(*) FROM ${questions} WHERE ${questions.subjectId} = ${subjects.id} AND ${questions.status} <> 'FLAGGED')::int`,
        teacherCount: sql<number>`(SELECT count(*) FROM ${teacherSubjects} WHERE ${teacherSubjects.subjectId} = ${subjects.id})::int`,
      })
      .from(subjects)
      .where(options.includeInactive ? undefined : eq(subjects.isActive, true))
      .orderBy(asc(subjects.name));
    return rows.map(toSubjectDto);
  }

  private async assertUnique(values: { name?: string; code?: string }, excludeId?: string) {
    const existing = await this.db
      .select({ id: subjects.id, name: subjects.name, code: subjects.code })
      .from(subjects)
      .where(
        sql`(${values.name ? sql`lower(${subjects.name}) = lower(${values.name})` : sql`false`} OR ${
          values.code ? sql`${subjects.code} = ${values.code}` : sql`false`
        })`,
      );
    const clash = existing.find((s) => s.id !== excludeId);
    if (clash) {
      throw new ConflictError(
        clash.code === values.code
          ? 'A subject with this code already exists'
          : 'A subject with this name already exists',
        'SUBJECT_EXISTS',
      );
    }
  }

  async create(input: CreateSubjectInput) {
    await this.assertUnique(input);
    const [row] = await this.db
      .insert(subjects)
      .values({ ...input, description: input.description || null })
      .returning();
    return toSubjectDto(row!);
  }

  async update(id: string, input: UpdateSubjectInput) {
    await this.assertUnique({ name: input.name, code: input.code }, id);
    const [row] = await this.db.update(subjects).set(input).where(eq(subjects.id, id)).returning();
    if (!row) throw new NotFoundError('Subject');
    return toSubjectDto(row);
  }
}
