import { createDatabase } from '../db/client.js';
import { userRepository } from '../repositories/user.repository.js';
import { hashPassword } from '../utils/password.js';
import { emailSchema, passwordSchema } from '../validators/common.validators.js';

async function main() {
  const email = emailSchema.parse(process.env.ADMIN_EMAIL);
  const passwordResult = passwordSchema.safeParse(process.env.ADMIN_PASSWORD);
  if (!passwordResult.success) {
    throw new Error(
      `ADMIN_PASSWORD is too weak: ${passwordResult.error.issues.map((i) => i.message).join('; ')}`,
    );
  }
  const fullName = process.env.ADMIN_NAME?.trim() || 'Platform Admin';
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL must be set');

  const { db, close } = createDatabase(url);
  try {
    if (await userRepository.existsByEmail(db, email)) {
      console.log(`An account with ${email} already exists – nothing to do.`);
      return;
    }
    await userRepository.create(db, {
      email,
      passwordHash: await hashPassword(passwordResult.data),
      fullName,
      role: 'ADMIN',
      department: 'Administration',
    });
    console.log(`Admin account created for ${email}.`);
  } finally {
    await close();
  }
}

main().catch((error: unknown) => {
  console.error('Failed to create admin:', error instanceof Error ? error.message : error);
  process.exit(1);
});
