import { eq, inArray } from 'drizzle-orm';
import type { Database } from './client.js';
import { answers, questions, subjects, teacherSubjects, users } from './schema.js';
import { DEMO_QUESTIONS, SUBJECT_SEED } from './seed-data.js';
import { hashPassword } from '../utils/password.js';

export async function seedSubjects(db: Database): Promise<number> {
  const inserted = await db
    .insert(subjects)
    .values(SUBJECT_SEED.map((s) => ({ ...s })))
    .onConflictDoNothing({ target: subjects.code })
    .returning({ id: subjects.id });
  return inserted.length;
}

async function upsertDemoUser(
  db: Database,
  data: {
    email: string;
    fullName: string;
    role: 'STUDENT' | 'TEACHER' | 'ADMIN';
    department: string;
    academicYear?: number;
  },
  passwordHash: string,
) {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, data.email));
  if (existing) return existing.id;
  const [created] = await db
    .insert(users)
    .values({ ...data, passwordHash })
    .returning({ id: users.id });
  return created!.id;
}

export async function seedDemoData(db: Database, password: string) {
  const passwordHash = await hashPassword(password);

  const adminId = await upsertDemoUser(
    db,
    {
      email: 'admin@studyai.dev',
      fullName: 'Platform Admin',
      role: 'ADMIN',
      department: 'Administration',
    },
    passwordHash,
  );
  const teacherId = await upsertDemoUser(
    db,
    {
      email: 'teacher@studyai.dev',
      fullName: 'Dr. Anita Rao',
      role: 'TEACHER',
      department: 'Computer Science',
    },
    passwordHash,
  );
  const studentId = await upsertDemoUser(
    db,
    {
      email: 'student@studyai.dev',
      fullName: 'Demo Student',
      role: 'STUDENT',
      department: 'Computer Science',
      academicYear: 2,
    },
    passwordHash,
  );
  const student2Id = await upsertDemoUser(
    db,
    {
      email: 'student2@studyai.dev',
      fullName: 'Second Student',
      role: 'STUDENT',
      department: 'Computer Science',
      academicYear: 3,
    },
    passwordHash,
  );

  const subjectRows = await db.select({ id: subjects.id, code: subjects.code }).from(subjects);
  const subjectByCode = new Map(subjectRows.map((s) => [s.code, s.id]));

  const teacherSubjectIds = ['CS201', 'CS202', 'CS203']
    .map((code) => subjectByCode.get(code))
    .filter((id): id is string => Boolean(id));
  await db
    .insert(teacherSubjects)
    .values(teacherSubjectIds.map((subjectId) => ({ teacherId, subjectId })))
    .onConflictDoNothing();

  const existingDemo = await db
    .select({ id: questions.id })
    .from(questions)
    .where(inArray(questions.authorId, [studentId, student2Id]))
    .limit(1);

  if (existingDemo.length === 0) {
    const created = await db
      .insert(questions)
      .values(
        DEMO_QUESTIONS.map((q, index) => ({
          authorId: index % 2 === 0 ? studentId : student2Id,
          subjectId: subjectByCode.get(q.subjectCode)!,
          title: q.title,
          description: q.description,
        })),
      )
      .returning({ id: questions.id, title: questions.title });

    const normalization = created.find((q) => q.title.includes('normalization'));
    if (normalization) {
      await db.insert(answers).values({
        questionId: normalization.id,
        authorId: teacherId,
        content:
          '2NF removes partial dependencies: every non-key attribute must depend on the *whole* composite key. 3NF additionally removes transitive dependencies: non-key attributes must not depend on other non-key attributes. Example: in Enrollment(StudentId, CourseId, StudentName, Grade), StudentName depends only on StudentId – a partial dependency – so move it to a Student table.',
      });
      await db
        .update(questions)
        .set({ status: 'ANSWERED' })
        .where(eq(questions.id, normalization.id));
    }
  }

  return { adminId, teacherId, studentId, student2Id };
}
