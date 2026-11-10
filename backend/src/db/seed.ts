import { createDatabase } from './client.js';
import { SUBJECT_SEED } from './seed-data.js';
import { seedDemoData, seedSubjects } from './seeders.js';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL must be set');

  const withDemo = process.argv.includes('--demo');
  if (withDemo && process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed demo accounts in production.');
  }

  const { db, close } = createDatabase(url);
  try {
    const count = await seedSubjects(db);
    console.log(`Subjects: ${count} inserted (${SUBJECT_SEED.length - count} already present).`);

    if (withDemo) {
      const password = process.env.SEED_DEMO_PASSWORD ?? 'StudyAI#Demo2026';
      await seedDemoData(db, password);
      console.log('Demo data seeded. Accounts (password from SEED_DEMO_PASSWORD or the default):');
      console.log(
        '  admin@studyai.dev | teacher@studyai.dev | student@studyai.dev | student2@studyai.dev',
      );
    }
  } finally {
    await close();
  }
}

main().catch((error: unknown) => {
  console.error('Seeding failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
