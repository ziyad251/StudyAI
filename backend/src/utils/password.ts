import bcrypt from 'bcryptjs';

const COST_FACTOR = process.env.NODE_ENV === 'test' ? 4 : 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST_FACTOR);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

let dummyHash: string | undefined;
export async function getDummyHash(): Promise<string> {
  dummyHash ??= await bcrypt.hash('timing-equaliser-not-a-real-password', COST_FACTOR);
  return dummyHash;
}
