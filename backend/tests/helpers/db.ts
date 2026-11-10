import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { Database } from '../../src/db/client.js';
import * as schema from '../../src/db/schema.js';
import { MIGRATIONS_FOLDER } from '../../src/db/paths.js';
import { seedSubjects } from '../../src/db/seeders.js';

export async function createTestDatabase(options: { seed?: boolean } = {}) {
  const client = new PGlite();
  const db = drizzle(client, { schema }) as unknown as Database;
  await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_FOLDER });
  if (options.seed !== false) await seedSubjects(db);
  return { db, client, close: () => client.close() };
}
