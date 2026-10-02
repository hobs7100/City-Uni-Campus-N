import type { PoolClient } from "pg";
import { getCoordinatorAttendanceStandings } from "./coordinator-attendance-standing";
import { getAttendancePolicy } from "./attendance-policy";

export type TriggeredBy = "COORDINATOR" | "ADMIN" | "HOD" | "SYSTEM";

export interface RunAutoStruckOffParams {
  studentIds: string[];
  semesterId: string;
  classIds: string[];
  triggeredBy: TriggeredBy;
  /** Caller owns a separate standing-evaluation transaction after attendance commits. */
  client: PoolClient;
}

/**
 * Only coordinator/admin daily marks may change enrollment standing.
 * Preserve the 15 personally evaluable attendance-day protection window,
 * including a fresh window after reactivation. Teacher course marks are ignored.
 */
export async function runAutoStruckOff({
  studentIds, semesterId, classIds, triggeredBy, client,
}: RunAutoStruckOffParams) {
  const struckOffIds: string[] = [];
  if (!studentIds.length || !classIds.length) return { struckOffIds };

  // Serialize with attendance, leave, and reactivation writes. Re-evaluate
  // after obtaining the locks so concurrent runs cannot duplicate audit events.
  const locked = await client.query<{ id: string }>(
    `select st.id from students st
     join semesters sem on sem.id = $1 and sem.class_id = st.class_id
     where st.id = any($2::uuid[]) and st.class_id = any($3::uuid[])
       and st.status = 'active' and st.deleted_at is null
     order by st.id for update of st`,
    [semesterId, studentIds, classIds],
  );
  const standings = await getCoordinatorAttendanceStandings(
    client, semesterId, locked.rows.map((row) => row.id),
  );

  for (const standing of standings) {
    if (!standing.eligible_for_strike_off) continue;
    const threshold = getAttendancePolicy(standing.leave_type).struckOffBelow;
    const updated = await client.query<{ id: string }>(
      `update students
       set status = 'struck_off',
           status_changed_by_name = 'Auto Struck Off — Short Attendance',
           status_change_date = now()::date,
           reactivated_at = null, updated_at = now()
       where id = $1 and status = 'active' and deleted_at is null
       returning id`,
      [standing.student_id],
    );
    if (!updated.rowCount) continue;
    await client.query(
      `insert into student_status_history
         (student_id, previous_status, new_status, reason, triggered_by,
          semester_id, attendance_pct, attendance_days)
       values ($1, 'active', 'struck_off', $2, $3, $4, $5, $6)`,
      [
        standing.student_id,
        `Auto Struck Off — Attendance ${standing.percentage!.toFixed(2)}% ` +
        `(${standing.presents} present / ${standing.evaluable_days} evaluable days) ` +
        `[threshold: below ${threshold}%; leave type: ${standing.leave_type}; source: coordinator]`,
        triggeredBy, semesterId, standing.percentage, standing.evaluable_days,
      ],
    );
    struckOffIds.push(standing.student_id);
  }
  return { struckOffIds };
}