import { query } from "@/lib/db";
import {
  getAttendanceFlag,
  ATTENDANCE_PROTECTION_DAYS,
  type StudentLeaveType,
} from "@/lib/attendance-policy";

export type AttendanceHistoryStatus = "present" | "absent" | "leave";
export type AttendanceStanding = "active" | "warning" | "struck_off";

export interface StudentAttendanceHistoryRecord {
  attendance_date: string;
  attendance_status: AttendanceHistoryStatus;
  percentage: number | null;
  standing: AttendanceStanding;
  is_protected: boolean;
  protection_days_completed: number;
  protection_days_required: number;
}

interface AttendanceRecordRow {
  attendance_date: string;
  status: AttendanceHistoryStatus;
  reactivation_date: string | null;
}

interface AttendanceHistoryOptions {
  from?: string | null;
  to?: string | null;
}

export async function getStudentAttendanceHistory(
  studentId: string,
  semesterId: string,
  leaveType: StudentLeaveType,
  options: AttendanceHistoryOptions = {},
): Promise<StudentAttendanceHistoryRecord[]> {
  const rows = await query<AttendanceRecordRow>(
    `select sar.attendance_date::text as attendance_date, sar.status,
            st.reactivated_at::date::text as reactivation_date
     from student_attendance_records sar
     join students st on st.id = sar.student_id
     where sar.student_id = $1 and sar.semester_id = $2
     order by sar.attendance_date asc, sar.created_at asc`,
    [studentId, semesterId],
  );

  let presents = 0;
  let absents = 0;
  let resetForReactivation = false;

  const history = rows.map((row) => {
    if (!resetForReactivation && row.reactivation_date && row.attendance_date > row.reactivation_date) {
      presents = 0;
      absents = 0;
      resetForReactivation = true;
    }
    if (row.status === "present") presents += 1;
    if (row.status === "absent") absents += 1;

    const evaluableDays = presents + absents;
    const rawPercentage =
      evaluableDays > 0
        ? (presents / evaluableDays) * 100
        : null;
    const percentage = rawPercentage === null ? null : Math.round(rawPercentage * 100) / 100;
    const flag =
      rawPercentage === null ? "ok" : getAttendanceFlag(rawPercentage, leaveType);

    return {
      attendance_date: row.attendance_date,
      attendance_status: row.status,
      percentage,
      standing: flag === "ok" ? "active" : flag,
      is_protected: evaluableDays < ATTENDANCE_PROTECTION_DAYS,
      protection_days_completed: evaluableDays,
      protection_days_required: ATTENDANCE_PROTECTION_DAYS,
    } satisfies StudentAttendanceHistoryRecord;
  });

  return history
    .filter(
      (record) =>
        (!options.from || record.attendance_date >= options.from) &&
        (!options.to || record.attendance_date <= options.to),
    )
    .reverse();
}