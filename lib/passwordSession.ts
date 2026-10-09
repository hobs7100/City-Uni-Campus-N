import bcrypt from "bcryptjs";
import { queryOne } from "./db";
import type { SessionData } from "./session";
import { DEFAULT_STUDENT_PASSWORD, DEFAULT_USER_PASSWORD } from "./password-policy";

export type AccountSource = "users" | "teachers" | "students";

export function accountTable(session: Pick<SessionData, "role" | "accountSource">): AccountSource {
  if (session.accountSource === "users" || session.accountSource === "teachers" || session.accountSource === "students") {
    return session.accountSource;
  }
  return session.role === "student" ? "students" : session.role === "teacher" ? "teachers" : "users";
}

/** Read fresh authentication state, so resetting an account revokes old cookies. */
export async function refreshSessionAuthentication(session: SessionData) {
  if (!session.isLoggedIn) return;
  const state = await queryOne<{
    must_change_password: boolean;
    password_version: number;
    status: string;
  }>(
    `select must_change_password, password_version, status
     from ${accountTable(session)} where id = $1 and deleted_at is null`,
    [session.userId],
  );
  if (!state || state.status === "blocked" || (session.passwordVersion ?? 0) !== state.password_version) {
    session.isLoggedIn = false;
    session.mustChangePassword = false;
    return;
  }
  session.mustChangePassword = state.must_change_password;
}

export async function resetAccountToDefault(source: AccountSource, id: string) {
  const password = source === "students" ? DEFAULT_STUDENT_PASSWORD : DEFAULT_USER_PASSWORD;
  const hash = await bcrypt.hash(password, 10);
  return queryOne<{ id: string }>(
    `update ${source} set password_hash = $1, must_change_password = true,
       password_version = password_version + 1, updated_at = now()
     where id = $2 and deleted_at is null returning id`,
    [hash, id],
  );
}

export async function savePersonalPassword(session: SessionData, hash: string) {
  return queryOne<{ password_version: number }>(
    `update ${accountTable(session)} set password_hash = $1,
       password_version = password_version + 1, updated_at = now()
     where id = $2 and password_version = $3 and must_change_password = false
       and deleted_at is null and status::text != 'blocked' returning password_version`,
    [hash, session.userId, session.passwordVersion ?? 0],
  );
}
