import type { PoolClient } from "pg";
import { ATTENDANCE_PROTECTION_DAYS, getAttendanceFlag, type StudentLeaveType } from "./attendance-policy";

interface StandingRow {
  student_id: string;
  semester_id: string;
  student_status: string;
  leave_type: StudentLeaveType;
  presents: number;
  evaluable_days: number;
  leaves: number;
}

/**
 * The same complete coordinator/admin attendance window drives automatic
 * decisions and their display. Report date filters must not change eligibility.
 * Leave days do not count; reactivation starts a fresh window after its date.
 * A semester must belong to the student's current class.
 */
export async function getCoordinatorAttendanceStandings(
  client: Pick<PoolClient, "query">,
  semesterId: string | string[],
  studentIds: string[],
) {
  if (!studentIds.length) return [];
  const result = await client.query<StandingRow>(
    `select st.id as student_id, sem.id as semester_id,
            st.status::text as student_status,
            case when exists (
              select 1 from student_leaves sl
              where sl.student_id = st.id and sl.revoked_at is null
                and sl.leave_type = 'partial'
            ) then 'partial'::varchar else 'permanent'::varchar end as leave_type,
            count(distinct sar.attendance_date) filter (
              where sar.status = 'present'
            )::int as presents,
            count(distinct sar.attendance_date) filter (
              where sar.status in ('present', 'absent')
            )::int as evaluable_days,
            count(distinct sar.attendance_date) filter (
              where sar.status = 'leave'
            )::int as leaves
     from students st
     join semesters sem on sem.id = any($1::uuid[]) and sem.class_id = st.class_id
     left join student_attendance_records sar
       on sar.student_id = st.id and sar.semester_id = sem.id
      and (st.reactivated_at is null or sar.attendance_date > st.reactivated_at::date)
     where st.id = any($2::uuid[]) and st.deleted_at is null
     group by st.id, sem.id`,
    [Array.isArray(semesterId) ? semesterId : [semesterId], studentIds],
  );
  return result.rows.map((row) => {
    const rawPercentage = row.evaluable_days > 0
      ? row.presents * 100 / row.evaluable_days
      : null;
    // Classify before rounding: e.g. 59.999% remains below 60%.
    const flag = rawPercentage === null ? "ok" : getAttendanceFlag(rawPercentage, row.leave_type);
    const isProtected = ["active", "permanent_leave"].includes(row.student_status)
      && row.evaluable_days < ATTENDANCE_PROTECTION_DAYS;
    return {
      ...row,
      percentage: rawPercentage === null ? null : Math.round(rawPercentage * 100) / 100,
      flag,
      is_protected: isProtected,
      protection_days_completed: row.evaluable_days,
      protection_days_required: ATTENDANCE_PROTECTION_DAYS,
      eligible_for_strike_off: row.student_status === "active"
        && !isProtected && flag === "struck_off",
    };
  });
}