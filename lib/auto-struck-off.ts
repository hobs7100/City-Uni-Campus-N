/**
 * Centralized auto-struck-off evaluation service.
 *
 * Called after coordinator/admin class-wide attendance is saved.
 * Only student_attendance_records are used for standing decisions; teacher
 * course attendance must not produce a struck-off status or a fine.
 *
 * Reactivation protection window
 * ───────────────────────────────
 * students.reactivated_at is set when a STRUCK_OFF student is reinstated.
 * The service only counts attendance days *after* that date, requiring the
 * student to accumulate 15 new working attendance days before being evaluated again.
 *
 * Everything runs inside the caller's already-open transaction (client param).
 */

import type { PoolClient } from "pg";

export type TriggeredBy = "COORDINATOR" | "ADMIN" | "HOD" | "SYSTEM";

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

const MIN_ATTENDANCE_DAYS = 15;
const REGULAR_STRUCK_OFF_THRESHOLD = 0.6;
const PARTIAL_LEAVE_STRUCK_OFF_THRESHOLD = 0.3;

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

/**
 * Return candidates to be struck off from coordinator records.
 * A candidate is an active student whose presents/(presents+absents) is below
 * their applicable threshold (30 % with an active partial leave, otherwise 60 %)
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
     leave_type: "permanent" | "partial";
  }>(
    `SELECT
       st.id,
       CASE WHEN EXISTS (
         SELECT 1 FROM student_leaves sl
         WHERE sl.student_id = st.id
           AND sl.revoked_at IS NULL
           AND sl.leave_type = 'partial'
       ) THEN 'partial'::varchar ELSE 'permanent'::varchar END AS leave_type,
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
       -- Each student must have ≥ 15 personally evaluable days before being struck off.
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
        ) < CASE WHEN EXISTS (
          SELECT 1 FROM student_leaves sl
          WHERE sl.student_id = st.id
            AND sl.revoked_at IS NULL
            AND sl.leave_type = 'partial'
        ) THEN $4 ELSE $5 END`,
     [semesterId, studentIds, MIN_ATTENDANCE_DAYS, PARTIAL_LEAVE_STRUCK_OFF_THRESHOLD, REGULAR_STRUCK_OFF_THRESHOLD]
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

  // Coordinator/admin daily attendance is the only standing source.
  const coordDays = await countCoordinatorClassDays(client, semesterId, classIds);
  if (coordDays < MIN_ATTENDANCE_DAYS) return;

  const candidates = await findCandidatesFromCoordinator(client, semesterId, studentIds);

  if (!candidates.length) return;

  // Strike off each candidate and log to audit history.
  for (const c of candidates) {
    const pct = c.evaluable > 0 ? (c.presents / c.evaluable) * 100 : 0;
    const attendancePct = Math.round(pct * 100) / 100;
    const threshold = c.leave_type === "partial" ? 30 : 60;

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
           `[threshold: below ${threshold}%; leave type: ${c.leave_type}; source: coordinator]`,
        triggeredBy,
        semesterId,
        attendancePct,
        c.window_days,
      ]
    );
  }
}
