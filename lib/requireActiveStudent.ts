/**
 * requireActiveStudent — gate for student APIs that must be inaccessible to
 * struck-off students and alumni.
 *
 * Usage (in a route GET/POST handler):
 *   const { session, studentStatus, response } = await requireActiveStudent();
 *   if (response) return response;
 *   // session.userId is safe to use; student is active
 *
 * Struck-off students and alumni may still access their profile, notifications,
 * tickets, and feedback; academic/exam-related endpoints return 403.
 */

import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

const STRUCK_OFF_RESPONSE = () => NextResponse.json(
  {
    error:
      "Your enrollment has been struck off due to insufficient attendance. " +
      "Please contact the administration to apply for reinstatement.",
    code: "STRUCK_OFF",
  },
  { status: 403 }
);

const ALUMNI_RESPONSE = () => NextResponse.json(
  {
    error: "Your enrollment is marked Alumni. Academic features are no longer available.",
    code: "ALUMNI",
  },
  { status: 403 }
);

export async function requireActiveStudent() {
  const { session, response } = await requireRole("student");
  if (response) return { session: null, studentStatus: null, response };

  const student = await queryOne<{ status: string }>(
    `select status from students where id = $1 and deleted_at is null`,
    [session!.userId]
  );
  if (!student) {
    return {
      session: null,
      studentStatus: null,
      response: NextResponse.json({ error: "Student not found." }, { status: 404 }),
    };
  }
  if (student.status === "struck_off") {
    return { session: null, studentStatus: "struck_off", response: STRUCK_OFF_RESPONSE() };
  }
  if (student.status === "alumni") {
    return { session: null, studentStatus: "alumni", response: ALUMNI_RESPONSE() };
  }

  return { session, studentStatus: student.status, response: null };
}
