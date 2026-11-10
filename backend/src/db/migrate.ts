import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { MIGRATIONS_FOLDER } from './paths.js';

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL (or DATABASE_URL_UNPOOLED) must be set to run migrations');
  }

  const pool = new pg.Pool({ connectionString: url, max: 1 });
  try {
    console.log(`Applying migrations from ${MIGRATIONS_FOLDER} ...`);
    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_FOLDER });
    console.log('Migrations applied successfully.');
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('Migration failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
