import { query } from "@/lib/db";
import {
  getAttendanceFlag,
  type StudentLeaveType,
} from "@/lib/attendance-policy";

export type AttendanceHistoryStatus = "present" | "absent" | "leave";
export type AttendanceStanding = "active" | "warning" | "struck_off";

export interface StudentAttendanceHistoryRecord {
  attendance_date: string;
  attendance_status: AttendanceHistoryStatus;
  percentage: number | null;
  standing: AttendanceStanding;
}

interface AttendanceRecordRow {
  attendance_date: string;
  status: AttendanceHistoryStatus;
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
    `select attendance_date, status
     from student_attendance_records
     where student_id = $1 and semester_id = $2
     order by attendance_date asc, created_at asc`,
    [studentId, semesterId],
  );

  let presents = 0;
  let absents = 0;

  const history = rows.map((row) => {
    if (row.status === "present") presents += 1;
    if (row.status === "absent") absents += 1;

    const evaluableDays = presents + absents;
    const percentage =
      evaluableDays > 0
        ? Math.round((presents / evaluableDays) * 10000) / 100
        : null;
    const flag =
      percentage === null ? "ok" : getAttendanceFlag(percentage, leaveType);

    return {
      attendance_date: row.attendance_date,
      attendance_status: row.status,
      percentage,
      standing: flag === "ok" ? "active" : flag,
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