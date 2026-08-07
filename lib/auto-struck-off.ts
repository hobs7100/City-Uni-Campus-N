/**
 * Centralized auto-struck-off evaluation service.
 *
 * Called from the coordinator attendance POST, teacher attendance POST, and the
 * admin manual short-attendance page so the logic is identical regardless of
 * who submits attendance.
 *
 * Attendance source selection
 * ───────────────────────────
 * Two attendance sources exist in the system:
 *   1. student_attendance_records  — coordinator marks class-wide attendance daily
 *   2. student_course_attendance   — teachers mark per-course attendance
 *
 * The service detects which source has reached the 10-distinct-day threshold
 * and uses that source for evaluation.  Coordinator records are checked first
 * because they are the canonical school-day source; if fewer than 10 coordinator
 * days are recorded for the class/semester the service falls back to teacher
 * course records (aggregated per student per day).
 *
 * Day aggregation for teacher records
 * ─────────────────────────────────────
 * A student's status for a given day is derived from all their course records on
 * that day:
 *   - "present" day  → at least one course record is 'present'
 *   - "evaluable" day → at least one course record is 'present' or 'absent'
 *   - "leave" day    → all course records are 'leave' → excluded from denominator
 *
 * Reactivation protection window
 * ───────────────────────────────
 * students.reactivated_at is set when a STRUCK_OFF student is reinstated.
 * The service only counts attendance days *after* that date, requiring the
 * student to accumulate 10 new days before being evaluated again.
 *
 * Everything runs inside the caller's already-open transaction (client param).
 */

import type { PoolClient } from "pg";

export type TriggeredBy = "COORDINATOR" | "TEACHER" | "ADMIN" | "HOD" | "SYSTEM";

export interface RunAutoStruckOffParams {
  /** IDs of students to evaluate (may be a subset of the class). */
  studentIds: string[];
  /** Active semester ID used to scope attendance records. */
  semesterId: string;
  /** Class IDs for the global attendance-day threshold check. */
  classIds: string[];
  /** Who triggered this evaluation (logged to student_status_history). */
  triggeredBy: TriggeredBy;
  /** Connected pg client — must already be inside BEGIN…COMMIT. */
  client: PoolClient;
}

const MIN_ATTENDANCE_DAYS = 10;
const STRUCK_OFF_THRESHOLD = 0.5; // < 50 % → struck off

type AttendanceSource = "coordinator" | "teacher" | "none";

/** Count distinct school days from coordinator records for the class/semester. */
async function countCoordinatorClassDays(
  client: PoolClient,
  semesterId: string,
  classIds: string[]
): Promise<number> {
  const res = await client.query<{ days: number }>(
    `SELECT COUNT(DISTINCT sar.attendance_date)::int AS days
     FROM   student_attendance_records sar
     JOIN   students st ON st.id = sar.student_id
     WHERE  sar.semester_id = $1
       AND  st.class_id     = ANY($2::uuid[])
       AND  st.deleted_at   IS NULL`,
    [semesterId, classIds]
  );
  return res.rows[0]?.days ?? 0;
}

/** Count distinct school days from teacher course attendance for the class/semester. */
async function countTeacherClassDays(
  client: PoolClient,
  semesterId: string,
  classIds: string[]
): Promise<number> {
  const res = await client.query<{ days: number }>(
    `SELECT COUNT(DISTINCT sca.attendance_date)::int AS days
     FROM   student_course_attendance sca
     JOIN   allocation_semesters als
               ON  als.allocation_id = sca.allocation_id
               AND als.semester_id   = $1
     JOIN   students st ON st.id = sca.student_id
     WHERE  st.class_id   = ANY($2::uuid[])
       AND  st.deleted_at IS NULL`,
    [semesterId, classIds]
  );
  return res.rows[0]?.days ?? 0;
}

/**
 * Return candidates to be struck off from coordinator records.
 * A candidate is an active student whose presents/(presents+absents) < 50 %
 * over their evaluation window (all semester, or after reactivated_at if set),
 * provided their window has ≥ MIN_ATTENDANCE_DAYS days.
 */
async function findCandidatesFromCoordinator(
  client: PoolClient,
  semesterId: string,
  studentIds: string[]
) {
  const res = await client.query<{
    id: string;
    window_days: number;
    presents: number;
    evaluable: number;
  }>(
    `SELECT
       st.id,
       -- window_days = distinct evaluable (present/absent) days for this student
       -- in their evaluation window.  Leave-only days are excluded so the threshold
       -- is never satisfied by leave records alone.
       COUNT(DISTINCT sar.attendance_date) FILTER (
         WHERE sar.status IN ('present','absent')
           AND (st.reactivated_at IS NULL OR sar.attendance_date > st.reactivated_at::date)
       )::int  AS window_days,
       COUNT(DISTINCT sar.attendance_date) FILTER (
         WHERE sar.status = 'present'
           AND (st.reactivated_at IS NULL OR sar.attendance_date > st.reactivated_at::date)
       )::int  AS presents,
       COUNT(DISTINCT sar.attendance_date) FILTER (
         WHERE sar.status IN ('present','absent')
           AND (st.reactivated_at IS NULL OR sar.attendance_date > st.reactivated_at::date)
       )::int  AS evaluable
     FROM   students st
     JOIN   student_attendance_records sar
               ON  sar.student_id  = st.id
               AND sar.semester_id = $1
     WHERE  st.id         = ANY($2::uuid[])
       AND  st.status     = 'active'
       AND  st.deleted_at IS NULL
     GROUP  BY st.id, st.reactivated_at
     HAVING
       -- Each student must have ≥ 10 personally evaluable days before being struck off.
       -- This prevents a new/incomplete-record student from being caught by the class
       -- threshold while their own sample is too small to be meaningful.
       COUNT(DISTINCT sar.attendance_date) FILTER (
         WHERE sar.status IN ('present','absent')
           AND (st.reactivated_at IS NULL OR sar.attendance_date > st.reactivated_at::date)
       ) >= $3
       AND (
         COUNT(DISTINCT sar.attendance_date) FILTER (
           WHERE sar.status = 'present'
             AND (st.reactivated_at IS NULL OR sar.attendance_date > st.reactivated_at::date)
         )::float
         / NULLIF(COUNT(DISTINCT sar.attendance_date) FILTER (
           WHERE sar.status IN ('present','absent')
             AND (st.reactivated_at IS NULL OR sar.attendance_date > st.reactivated_at::date)
         ), 0)
       ) < $4`,
    [semesterId, studentIds, MIN_ATTENDANCE_DAYS, STRUCK_OFF_THRESHOLD]
  );
  return res.rows;
}

/**
 * Return candidates to be struck off from teacher course attendance records.
 *
 * Day aggregation:
 *   "present" day  = at least one course record on that day is 'present'
 *   "evaluable" day = at least one course record on that day is 'present' or 'absent'
 *
 * This correctly handles days where a student attends some courses but misses others
 * (counted as "present") and all-leave days (excluded from the denominator).
 */
async function findCandidatesFromTeacher(
  client: PoolClient,
  semesterId: string,
  studentIds: string[]
) {
  const res = await client.query<{
    id: string;
    window_days: number;
    presents: number;
    evaluable: number;
  }>(
    `SELECT
       st.id,
       -- window_days = distinct evaluable (present/absent) days for this student.
       -- Days where all course records are 'leave' do not count toward the threshold
       -- so a student cannot be struck off on a sample of leave-only records.
       COUNT(DISTINCT sca.attendance_date) FILTER (
         WHERE sca.status IN ('present','absent')
           AND (st.reactivated_at IS NULL OR sca.attendance_date > st.reactivated_at::date)
       )::int  AS window_days,
       -- "Present" days: at least one course record is 'present' that day
       COUNT(DISTINCT sca.attendance_date) FILTER (
         WHERE sca.status = 'present'
           AND (st.reactivated_at IS NULL OR sca.attendance_date > st.reactivated_at::date)
       )::int  AS presents,
       -- "Evaluable" days = window_days (same expression, alias reused for clarity)
       COUNT(DISTINCT sca.attendance_date) FILTER (
         WHERE sca.status IN ('present','absent')
           AND (st.reactivated_at IS NULL OR sca.attendance_date > st.reactivated_at::date)
       )::int  AS evaluable
     FROM   students st
     JOIN   student_course_attendance sca ON sca.student_id = st.id
     JOIN   allocation_semesters als
               ON  als.allocation_id = sca.allocation_id
               AND als.semester_id   = $1
     WHERE  st.id         = ANY($2::uuid[])
       AND  st.status     = 'active'
       AND  st.deleted_at IS NULL
     GROUP  BY st.id, st.reactivated_at
     HAVING
       -- Require ≥ 10 personally evaluable days before the student can be struck off.
       COUNT(DISTINCT sca.attendance_date) FILTER (
         WHERE sca.status IN ('present','absent')
           AND (st.reactivated_at IS NULL OR sca.attendance_date > st.reactivated_at::date)
       ) >= $3
       AND (
         COUNT(DISTINCT sca.attendance_date) FILTER (
           WHERE sca.status = 'present'
             AND (st.reactivated_at IS NULL OR sca.attendance_date > st.reactivated_at::date)
         )::float
         / NULLIF(COUNT(DISTINCT sca.attendance_date) FILTER (
           WHERE sca.status IN ('present','absent')
             AND (st.reactivated_at IS NULL OR sca.attendance_date > st.reactivated_at::date)
         ), 0)
       ) < $4`,
    [semesterId, studentIds, MIN_ATTENDANCE_DAYS, STRUCK_OFF_THRESHOLD]
  );
  return res.rows;
}

export async function runAutoStruckOff({
  studentIds,
  semesterId,
  classIds,
  triggeredBy,
  client,
}: RunAutoStruckOffParams): Promise<void> {
  if (!studentIds.length || !classIds.length) return;

  // ── Step 1: Determine which attendance source is in use ──────────────────
  // Coordinator records are the canonical source; fall back to teacher records
  // for classes that only use teacher-level attendance (no coordinator).
  let source: AttendanceSource = "none";
  const coordDays = await countCoordinatorClassDays(client, semesterId, classIds);
  if (coordDays >= MIN_ATTENDANCE_DAYS) {
    source = "coordinator";
  } else {
    const teacherDays = await countTeacherClassDays(client, semesterId, classIds);
    if (teacherDays >= MIN_ATTENDANCE_DAYS) source = "teacher";
  }
  if (source === "none") return; // Threshold not reached from either source

  // ── Step 2: Find candidates using the appropriate source ─────────────────
  const candidates =
    source === "coordinator"
      ? await findCandidatesFromCoordinator(client, semesterId, studentIds)
      : await findCandidatesFromTeacher(client, semesterId, studentIds);

  if (!candidates.length) return;

  // ── Step 3: Strike off each candidate and log to audit history ───────────
  for (const c of candidates) {
    const pct = c.evaluable > 0 ? (c.presents / c.evaluable) * 100 : 0;
    const attendancePct = Math.round(pct * 100) / 100;

    await client.query(
      `UPDATE students
       SET    status                 = 'struck_off',
              status_changed_by_name = 'Auto Struck Off — Short Attendance',
              status_change_date     = now()::date,
              reactivated_at         = NULL,
              updated_at             = now()
       WHERE  id         = $1
         AND  status     = 'active'
         AND  deleted_at IS NULL`,
      [c.id]
    );

    await client.query(
      `INSERT INTO student_status_history
         (student_id, previous_status, new_status, reason,
          triggered_by, semester_id, attendance_pct, attendance_days)
       VALUES ($1, 'active', 'struck_off', $2, $3, $4, $5, $6)`,
      [
        c.id,
        `Auto Struck Off — Attendance ${attendancePct.toFixed(2)}% ` +
          `(${c.presents} present / ${c.evaluable} evaluable over ${c.window_days} days) ` +
          `[source: ${source}]`,
        triggeredBy,
        semesterId,
        attendancePct,
        c.window_days,
      ]
    );
  }
}
