export type ExamSlipKind = "rollno" | "clearance";
export interface SlipCourseRow {
  course_id: string;
  course_title: string;
  course_code: string;
  credit_hours: string;
  paper_date: string | null;
  paper_time: string | null;
  att_percentage: number;
}
export interface SlipData {
  student: {
    id: string; name: string; father_name: string | null;
    class_name: string; session: string; department: string; profile_image_url: string | null;
  };
  semester: { id: string; semester_number: number; term_type: string };
  overall_attendance: number;
  roll_number_slip_threshold?: number;
  rows: SlipCourseRow[];
}
