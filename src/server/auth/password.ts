import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Minimum viable password policy. Kept simple and explicit rather than a
 * "strength meter" — production apps should pair this with a breached-
 * password check (e.g. HaveIBeenPwned range API) before go-live.
 */
export function isPasswordStrongEnough(password: string): boolean {
  return password.length >= 8;
}
