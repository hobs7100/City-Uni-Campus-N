import { query } from "@/lib/db";

export type AttendanceFineAdjustmentType = "discount" | "waive";

export type AttendanceFineAssessment = {
  student_id: string;
  name: string;
  father_name: string | null;
  roll_no: string | null;
  status: "active" | "struck_off";
  department_id: string;
  department_name: string;
  class_id: string;
  class_name: string;
  session: string;
  semester_id: string;
  semester_number: number;
  assessment_cycle_id: string;
  assessment_cycle_started_at: string | null;
  attendance_percentage: number;
  evaluable_days: number;
  presents: number;
  leave_type: "partial" | null;
  fine_threshold: number;
  is_protected: boolean;
  protection_days_completed: number;
  protection_days_required: number;
  gross_amount: number;
  adjustment_type: AttendanceFineAdjustmentType | null;
  discount_amount: number;
  adjustment_reason: string | null;
  adjusted_by_name: string | null;
  adjusted_at: string | null;
  net_amount: number;
};

const PROTECTION_DAYS = 15;

export function calculateAttendanceFineAmount(
  percentage: number,
  status: "active" | "struck_off",
  leaveType: "partial" | null = null,
) {
  const threshold = leaveType === "partial" ? 40 : 76;
  let amount = 0;

  if (percentage < threshold) {
    if (percentage >= 70) amount = 500;
    else if (percentage >= 65) amount = 1000;
    else if (percentage >= 60) amount = 2000;
    else amount = 2000 + Math.ceil((60 - Math.max(percentage, 0)) / 5) * 500;
  }

  return status === "struck_off" ? Math.max(5000, amount) : amount;
}

type FineRow = {
  student_id: string;
  name: string;
  father_name: string | null;
  roll_no: string | null;
  status: "active" | "struck_off";
  department_id: string;
  department_name: string;
  class_id: string;
  class_name: string;
  session: string;
  semester_id: string;
  semester_number: number;
  assessment_cycle_id: string;
  fine_cycle_started_at: string | null;
  leave_type: "partial" | null;
  presents: number;
  evaluable_days: number;
  adjustment_type: AttendanceFineAdjustmentType | "clear" | null;
  discount_amount: string | null;
  adjustment_reason: string | null;
  adjusted_by_name: string | null;
  adjusted_at: string | null;
};

export async function getCurrentAttendanceFineAssessments(studentId?: string) {
  const values: unknown[] = [];
  const studentFilter = studentId ? "and st.id = $1" : "";
  if (studentId) values.push(studentId);

  const rows = await query<FineRow>(
    `select
       st.id as student_id, st.name, st.father_name, st.roll_no,
       st.status::text as status, st.department_id, d.name as department_name,
       st.class_id, cl.class_name, cl.session, sem.id as semester_id,
       sem.semester_number,
       st.attendance_fine_cycle_id::text as assessment_cycle_id,
       st.attendance_fine_cycle_started_at::text as fine_cycle_started_at,
       active_leave.leave_type,
       count(distinct sar.attendance_date) filter (
         where sar.status = 'present'
           and (st.attendance_fine_cycle_started_at is null
                or sar.attendance_date > st.attendance_fine_cycle_started_at)
       )::int as presents,
       count(distinct sar.attendance_date) filter (
         where sar.status in ('present', 'absent')
           and (st.attendance_fine_cycle_started_at is null
                or sar.attendance_date > st.attendance_fine_cycle_started_at)
       )::int as evaluable_days,
       afa.adjustment_type, afa.discount_amount::text,
       afa.reason as adjustment_reason, u.name as adjusted_by_name,
       afa.created_at::text as adjusted_at
     from students st
     join classes cl on cl.id = st.class_id
     join departments d on d.id = st.department_id
     join lateral (
       select s.id, s.semester_number
       from semesters s
       where s.class_id = st.class_id and s.status in ('active', 'mid_term')
       order by case s.status when 'mid_term' then 0 else 1 end
       limit 1
     ) sem on true
     left join student_attendance_records sar
       on sar.student_id = st.id and sar.semester_id = sem.id
     left join lateral (
       select 'partial'::varchar as leave_type
       from student_leaves sl
       where sl.student_id = st.id
         and sl.revoked_at is null
         and sl.leave_type = 'partial'
       limit 1
     ) active_leave on true
     left join lateral (
       select a.adjustment_type, a.discount_amount, a.reason,
              a.adjusted_by, a.created_at
       from attendance_fine_adjustments a
       where a.student_id = st.id
         and a.semester_id = sem.id
         and a.assessment_cycle_id = st.attendance_fine_cycle_id
       order by a.created_at desc, a.id desc
       limit 1
     ) afa on true
     left join users u on u.id = afa.adjusted_by
     where st.deleted_at is null
       and st.status in ('active', 'struck_off')
       ${studentFilter}
     group by st.id, st.name, st.father_name, st.roll_no, st.status,
       st.department_id, d.name, st.class_id, cl.class_name, cl.session,
       sem.id, sem.semester_number, st.attendance_fine_cycle_started_at,
       active_leave.leave_type, afa.adjustment_type, afa.discount_amount,
       afa.reason, u.name, afa.created_at
     order by d.name, cl.class_name, st.name`,
    values,
  );

  return rows.flatMap<AttendanceFineAssessment>((row) => {
    const rawPercentage = row.evaluable_days > 0
      ? (row.presents / row.evaluable_days) * 100
      : 0;
    const percentage = Number(rawPercentage.toFixed(2));
    const isProtected = row.status === "active"
      && row.fine_cycle_started_at !== null
      && row.evaluable_days < PROTECTION_DAYS;
    const grossAmount = isProtected
      ? 0
      : calculateAttendanceFineAmount(rawPercentage, row.status, row.leave_type);

    if (grossAmount === 0 && !isProtected) return [];

    const effectiveAdjustment = row.adjustment_type === "clear" ? null : row.adjustment_type;
    const discount = effectiveAdjustment === "discount"
      ? Math.min(Number(row.discount_amount ?? 0), grossAmount)
      : 0;
    const netAmount = effectiveAdjustment === "waive"
      ? 0
      : Math.max(0, grossAmount - discount);

    return [{
      student_id: row.student_id,
      name: row.name,
      father_name: row.father_name,
      roll_no: row.roll_no,
      status: row.status,
      department_id: row.department_id,
      department_name: row.department_name,
      class_id: row.class_id,
      class_name: row.class_name,
      session: row.session,
      semester_id: row.semester_id,
      semester_number: row.semester_number,
      assessment_cycle_id: row.assessment_cycle_id,
      assessment_cycle_started_at: row.fine_cycle_started_at,
      attendance_percentage: percentage,
      evaluable_days: row.evaluable_days,
      presents: row.presents,
      leave_type: row.leave_type,
      fine_threshold: row.leave_type === "partial" ? 40 : 76,
      is_protected: isProtected,
      protection_days_completed: row.evaluable_days,
      protection_days_required: PROTECTION_DAYS,
      gross_amount: grossAmount,
      adjustment_type: effectiveAdjustment,
      discount_amount: discount,
      adjustment_reason: row.adjustment_reason,
      adjusted_by_name: row.adjusted_by_name,
      adjusted_at: row.adjusted_at,
      net_amount: netAmount,
    }];
  });
}

export async function getCurrentAttendanceFine(studentId: string) {
  return (await getCurrentAttendanceFineAssessments(studentId))[0] ?? null;
}