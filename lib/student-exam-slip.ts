import { query, queryOne } from "./db";
import { getRollNumberSlipThreshold, type StudentLeaveType } from "./attendance-policy";
import { getCurrentAttendanceFine } from "./attendance-fines";
import type { ExamSlipKind, SlipCourseRow } from "./exam-slip-types";
import { pool } from "./db";
import { getCoordinatorAttendanceStandings } from "./coordinator-attendance-standing";

/** Shared eligibility rules for Mid Term roll-number and Final Term clearance slips. */
export async function getStudentExamSlip(studentId: string, kind: ExamSlipKind) {
  const title = kind === "clearance" ? "Clearance Slip" : "Roll Number Slip";
  const exam = kind === "clearance" ? "Final Term" : "Mid Term";
  const blocked = (reason: string, message: string) => ({ allowed: false as const, reason, message });
  const student = await queryOne<{
    id: string; name: string; father_name: string | null; class_id: string;
    class_name: string; session: string; status: string; department_name: string;
    profile_image_url: string | null; active_leave_type: StudentLeaveType;
  }>(
    `select st.id, st.name, st.father_name, st.class_id, cl.class_name,
            st.session, st.status, d.name as department_name, st.profile_image_url,
            active_leave.leave_type as active_leave_type
     from students st join classes cl on cl.id = st.class_id
     join departments d on d.id = st.department_id
     left join lateral (
       select leave_type from student_leaves
       where student_id = st.id and revoked_at is null
       order by created_at desc limit 1
     ) active_leave on true
     where st.id = $1 and st.deleted_at is null`, [studentId],
  );
  if (!student) return null;
  if (!student.profile_image_url) {
    return blocked("missing_profile_photo", `Please upload your profile picture from the Profile section before generating your ${title}.`);
  }
  if (!["active", "permanent_leave"].includes(student.status)) {
    return blocked("inactive_student", `Your enrollment status is "${student.status}". Only active students and students on permanent leave are permitted to generate a ${title}.`);
  }
  const semester = await queryOne<{ id: string; semester_number: number; term_type: string }>(
    `select id, semester_number, term_type from semesters
     where class_id = $1 and status in ('active', 'mid_term')
     order by case status when 'mid_term' then 0 else 1 end limit 1`, [student.class_id],
  );
  if (!semester) {
    return blocked("no_active_semester", "There is no active semester for your class at this time. Please check back later.");
  }
  const courses = await query<Omit<SlipCourseRow, "att_percentage">>(
    `select distinct on (sc.course_id) sc.course_id,
       c.title as course_title, c.code as course_code, c.credit_hours::text as credit_hours,
       to_char(med.paper_date, 'YYYY-MM-DD') as paper_date,
       to_char(med.paper_time, 'HH12:MI AM') as paper_time
     from semester_courses sc join courses c on c.id = sc.course_id
     left join mid_exam_datesheets med on med.semester_id = sc.semester_id and med.course_id = sc.course_id
     where sc.semester_id = $1 order by sc.course_id, c.title`, [semester.id],
  );
  // Clearance certifies enrolled courses, not a Mid Term examination schedule.
  if (kind === "rollno" && !courses.some((course) => course.paper_date !== null)) {
    return blocked("no_datesheet", "The Mid Exam Date Sheet for the current semester has not been published yet. Please check back once the Admin has created the date sheet.");
  }
  if (kind === "clearance" && !courses.length) {
    return blocked("no_enrolled_courses", "No enrolled courses are available for your current semester. Please contact the administration.");
  }
  // Coordinator/Assistant/Admin daily attendance is the sole eligibility source.
  // Leave marks are excluded. Preserve the existing whole-semester slip window.
  const attendance = await queryOne<{ presents: string; absents: string }>(
    `select count(*) filter (where status = 'present')::text as presents,
            count(*) filter (where status = 'absent')::text as absents
     from student_attendance_records where student_id = $1 and semester_id = $2`, [studentId, semester.id],
  );
  const presents = Number(attendance?.presents ?? 0), absents = Number(attendance?.absents ?? 0);
  const percentage = presents + absents ? presents * 100 / (presents + absents) : 0;
  const threshold = getRollNumberSlipThreshold(student.active_leave_type ?? null);
  const [standing] = await getCoordinatorAttendanceStandings(pool, semester.id, [studentId]);
  const isProtected = standing?.is_protected === true;
  const attendanceFine = await getCurrentAttendanceFine(studentId);
  const finePaid = attendanceFine?.semester_id === semester.id
    && attendanceFine.paid_amount > 0 && attendanceFine.net_amount === 0;
  if (percentage < threshold && !isProtected && !finePaid) {
    const override = await queryOne<{ id: string }>("select id from rollno_slip_overrides where student_id = $1", [studentId]);
    if (!override) {
      const fineMessage = attendanceFine?.semester_id === semester.id && attendanceFine.net_amount > 0
        ? ` Your unpaid attendance fine is PKR ${attendanceFine.net_amount.toLocaleString("en-PK")}. Please contact the administration to pay it; once fully paid, the attendance-based printing block will be removed.`
        : " Please contact the administration to review your attendance and slip eligibility.";
      return blocked("low_attendance", `Your overall attendance is ${percentage.toFixed(1)}%, below the required ${threshold}%, and you are outside the attendance protection window. Your ${title} for the ${exam} Examination cannot be generated.${fineMessage}`);
    }
  }
  const attendanceByCourse = new Map<string, number>();
  if (kind === "rollno") {
    // Informational course annotations remain exclusive to the existing Mid slip.
    const rows = await query<{ course_id: string; presents: string; absents: string }>(
      `select a.course_id,
         count(*) filter (where sca.status = 'present')::text as presents,
         count(*) filter (where sca.status = 'absent')::text as absents
       from student_course_attendance sca
       join allocations a on a.id = sca.allocation_id
       join allocation_semesters als on als.allocation_id = a.id and als.semester_id = $1
       where sca.student_id = $2 group by a.course_id`, [semester.id, studentId],
    );
    for (const row of rows) {
      const p = Number(row.presents), a = Number(row.absents);
      attendanceByCourse.set(row.course_id, p + a ? p * 100 / (p + a) : 100);
    }
  }
  return {
    allowed: true as const,
    student: {
      id: student.id, name: student.name, father_name: student.father_name,
      class_name: student.class_name, session: student.session,
      department: student.department_name, profile_image_url: student.profile_image_url,
    },
    semester,
    overall_attendance: Math.round(percentage * 100) / 100,
    roll_number_slip_threshold: threshold,
    is_protected: isProtected,
    protection_days_completed: standing?.protection_days_completed ?? 0,
    protection_days_required: standing?.protection_days_required ?? 15,
    attendance_fine: attendanceFine?.semester_id === semester.id ? attendanceFine : null,
    rows: courses.filter((course) => kind === "clearance" || course.paper_date !== null)
      .map((course) => ({ ...course,
        // Never imply that the Mid Term paper date is a Final Term schedule.
        ...(kind === "clearance" ? { paper_date: null, paper_time: null } : {}),
        att_percentage: Math.round((attendanceByCourse.get(course.course_id) ?? 100) * 100) / 100,
      })),
  };
}
