import bcrypt from "bcryptjs";
import { queryOne, query } from "./db";
import type { UserRole } from "./session";

export interface AuthenticatedAccount {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: string;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function generateRandomPassword(length = 10) {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Attempts to authenticate against users (admin/hod/coordinator), then
 * teachers, then students, in that order, by email.
 */
export async function findAccountByEmail(
  email: string
): Promise<
  | (AuthenticatedAccount & { password_hash: string; source: "users" | "teachers" | "students" })
  | null
> {
  const user = await queryOne<{
    id: string;
    name: string;
    email: string;
    role: UserRole;
    status: string;
    password_hash: string;
  }>(
    `select id, name, email, role, status, password_hash from users where email = $1 and deleted_at is null`,
    [email]
  );
  if (user) {
    return { ...user, source: "users" };
  }

  const teacher = await queryOne<{
    id: string;
    name: string;
    email: string;
    status: string;
    password_hash: string;
  }>(
    `select id, name, email, status, password_hash from teachers where email = $1 and deleted_at is null`,
    [email]
  );
  if (teacher) {
    return { ...teacher, role: "teacher", source: "teachers" };
  }

  const student = await queryOne<{
    id: string;
    name: string;
    email: string;
    status: string;
    password_hash: string;
  }>(
    `select id, name, email, status, password_hash from students where email = $1 and deleted_at is null`,
    [email]
  );
  if (student) {
    return { ...student, role: "student", source: "students" };
  }

  return null;
}

export async function recordLoginActivity(
  actorType: "user" | "teacher" | "student",
  actorId: string,
  email: string,
  ipAddress?: string | null,
  userAgent?: string | null
) {
  await query(
    `insert into login_activity (actor_type, actor_id, email, ip_address, user_agent) values ($1, $2, $3, $4, $5)`,
    [actorType, actorId, email, ipAddress ?? null, userAgent ?? null]
  );
}
