import type { UserRole } from "@/lib/session";

export const PORTAL_MODULES = [
  {
    key: "campus_report",
    label: "Campus Report",
    description: "Campus-wide academic and enrollment reporting",
    icon: "FileSearch",
    adminHref: "/dashboard/admin/campus-report",
    dashboardPath: "/dashboard/admin/campus-report",
    apiPath: "/api/admin/campus-report",
  },
  {
    key: "syllabus_report",
    label: "Syllabus Report",
    description: "Syllabus completion and coverage reporting",
    icon: "BookCheck",
    adminHref: "/dashboard/admin/syllabus-report",
    dashboardPath: "/dashboard/admin/syllabus-report",
    apiPath: "/api/admin/syllabus-report",
  },
  {
    key: "overall_classes_summary",
    label: "Overall Classes Summary",
    description: "Summary of classes, enrollment, and academic status",
    icon: "School",
    adminHref: "/dashboard/admin/overall-classes-summary",
    dashboardPath: "/dashboard/admin/overall-classes-summary",
    apiPath: "/api/admin/overall-classes-summary",
  },
  {
    key: "users",
    label: "Users",
    description: "User accounts, roles, passwords, and removal",
    icon: "Users",
    adminHref: "/dashboard/admin/users",
    dashboardPath: "/dashboard/admin/users",
    apiPath: "/api/admin/users",
  },
  {
    key: "affiliations",
    label: "Affiliations",
    description: "Campus affiliations and affiliated institutions",
    icon: "Landmark",
    adminHref: "/dashboard/admin/affiliations",
    dashboardPath: "/dashboard/admin/affiliations",
    apiPath: "/api/admin/affiliations",
  },
  {
    key: "students",
    label: "Students",
    description: "Student profiles, status changes, passwords, and removal",
    icon: "GraduationCap",
    adminHref: "/dashboard/admin/students",
    dashboardPath: "/dashboard/admin/students",
    apiPath: "/api/admin/students",
  },
  {
    key: "teachers",
    label: "Teachers",
    description: "Teacher records, account details, passwords, and removal",
    icon: "UsersRound",
    adminHref: "/dashboard/admin/teachers",
    dashboardPath: "/dashboard/admin/teachers",
    apiPath: "/api/admin/teachers",
  },
  {
    key: "departments",
    label: "Faculties",
    description: "Faculty records and assigned HoD or coordinator",
    icon: "Building2",
    adminHref: "/dashboard/admin/departments",
    dashboardPath: "/dashboard/admin/departments",
    apiPath: "/api/admin/departments",
  },
  {
    key: "classes",
    label: "Classes",
    description: "Class details, schemes of studies, and removal",
    icon: "School",
    adminHref: "/dashboard/admin/classes",
    dashboardPath: "/dashboard/admin/classes",
    apiPath: "/api/admin/classes",
  },
  {
    key: "courses",
    label: "Course Catalog",
    description: "Catalog courses and course-outline files",
    icon: "BookOpen",
    adminHref: "/dashboard/admin/courses",
    dashboardPath: "/dashboard/admin/courses",
    apiPath: "/api/admin/courses",
  },
  {
    key: "semesters",
    label: "Semesters",
    description: "Semester lifecycle, curriculum, and outlines",
    icon: "CalendarRange",
    adminHref: "/dashboard/admin/semesters",
    dashboardPath: "/dashboard/admin/semesters",
    apiPath: "/api/admin/semesters",
  },
  {
    key: "allocations",
    label: "Allocations",
    description: "Teacher-course allocations and transfers",
    icon: "ClipboardList",
    adminHref: "/dashboard/admin/allocations",
    dashboardPath: "/dashboard/admin/allocations",
    apiPath: "/api/admin/allocations",
  },
  {
    key: "timetables",
    label: "Timetables",
    description: "Timetable creation, slots, days, and course assignments",
    icon: "CalendarClock",
    adminHref: "/dashboard/admin/timetables",
    dashboardPath: "/dashboard/admin/timetables",
    apiPath: "/api/admin/timetables",
  },
  {
    key: "attendance",
    label: "Teacher Attendance",
    description: "Teacher attendance records and lecture tracking",
    icon: "UserCheck",
    adminHref: "/dashboard/admin/attendance",
    dashboardPath: "/dashboard/admin/attendance",
    apiPath: "/api/admin/attendance",
  },
  {
    key: "student_attendance",
    label: "Student Attendance",
    description: "Student attendance rosters, reports, and corrections",
    icon: "ClipboardCheck",
    adminHref: "/dashboard/admin/student-attendance",
    dashboardPath: "/dashboard/admin/student-attendance",
    apiPath: "/api/admin/student-attendance",
  },
  {
    key: "daily_attendance",
    label: "Daily Attendance",
    description: "Daily student attendance operations and reporting",
    icon: "ClipboardCheck",
    adminHref: "/dashboard/admin/daily-student-attendance",
    dashboardPath: "/dashboard/admin/daily-student-attendance",
    apiPath: "/api/admin/daily-student-attendance",
  },
  {
    key: "billing",
    label: "Billing",
    description: "Student billing, invoices, and payment records",
    icon: "Wallet",
    adminHref: "/dashboard/admin/billing",
    dashboardPath: "/dashboard/admin/billing",
    apiPath: "/api/admin/bills",
  },
  {
    key: "fines",
    label: "Fine",
    description: "Student fines and payment status",
    icon: "Wallet",
    adminHref: "/dashboard/admin/fines",
    dashboardPath: "/dashboard/admin/fines",
    apiPath: "/api/admin/fines",
  },
  {
    key: "results",
    label: "Exams & Results",
    description: "Examinations, result submissions, and academic outcomes",
    icon: "Award",
    adminHref: "/dashboard/admin/results",
    dashboardPath: "/dashboard/admin/results",
    apiPath: "/api/admin/results",
    apiPaths: ["/api/admin/mid-exam-datesheet", "/api/admin/re-mid-exam-datesheet"],
  },
  {
    key: "dept_attendance",
    label: "Dept. Attendance",
    description: "Department attendance summaries and details",
    icon: "BarChart2",
    adminHref: "/dashboard/admin/dept-attendance",
    dashboardPath: "/dashboard/admin/dept-attendance",
    apiPath: "/api/admin/dept-attendance",
    apiPaths: ["/api/admin/dept-attendance-details"],
  },
  {
    key: "course_attendance",
    label: "Course Attendance",
    description: "Attendance summaries by course",
    icon: "BookCheck",
    adminHref: "/dashboard/admin/course-attendance",
    dashboardPath: "/dashboard/admin/course-attendance",
    apiPath: "/api/admin/course-attendance",
  },
  {
    key: "leave_management",
    label: "Leave Management",
    description: "Student leave requests and approvals",
    icon: "UserX",
    adminHref: "/dashboard/admin/leave-management",
    dashboardPath: "/dashboard/admin/leave-management",
    apiPath: "/api/admin/leave-management",
  },
  {
    key: "dit_mock",
    label: "DIT Mock Exam",
    description: "DIT mock examination test series and results",
    icon: "PenLine",
    adminHref: "/dashboard/admin/dit-mock",
    dashboardPath: "/dashboard/admin/dit-mock",
    apiPath: "/api/admin/dit",
  },
  {
    key: "rollno_slips",
    label: "Roll No. Slips",
    description: "Roll number slip generation and overrides",
    icon: "FileCheck2",
    adminHref: "/dashboard/admin/rollno-slips",
    dashboardPath: "/dashboard/admin/rollno-slips",
    apiPath: "/api/admin/rollno-slips",
  },
  {
    key: "lat_slip",
    label: "LAT Slip",
    description: "Generate LAT preparation charge slips",
    icon: "ReceiptText",
    adminHref: "/dashboard/admin/lat-slip",
    dashboardPath: "/dashboard/admin/lat-slip",
    apiPath: "/api/admin/lat-slip",
  },
  {
    key: "notifications",
    label: "Notifications",
    description: "Campus notifications and targeted announcements",
    icon: "Bell",
    adminHref: "/dashboard/admin/notifications",
    dashboardPath: "/dashboard/admin/notifications",
    apiPath: "/api/admin/notifications",
  },
  {
    key: "feedback",
    label: "Feedback",
    description: "Student complaints and feedback workflow",
    icon: "MessageSquare",
    adminHref: "/dashboard/admin/feedback",
    dashboardPath: "/dashboard/admin/feedback",
    apiPath: "/api/admin/feedback",
  },
] as const;

export type PortalModule = (typeof PORTAL_MODULES)[number]["key"];
export type PortalAction = "view" | "edit" | "delete";
export type PortalPreset = "hidden" | "read_only" | "edit" | "full_access";

export const PORTAL_MANAGED_ROLES = [
  { key: "assistant", label: "Assistant" },
  { key: "coordinator", label: "Coordinator" },
  { key: "hod", label: "Head of Department" },
  { key: "finance_manager", label: "Finance Manager" },
] as const satisfies ReadonlyArray<{ key: UserRole; label: string }>;

export type PortalManagedRole = (typeof PORTAL_MANAGED_ROLES)[number]["key"];

/**
 * Read-only lookup dependencies. A role may read these supporting list APIs
 * while viewing the parent module, but receives no page or mutation access to
 * the supporting module.
 */
export const PORTAL_READ_DEPENDENCIES: Partial<
  Record<PortalModule, readonly PortalModule[]>
> = {
  campus_report: ["departments", "classes", "students", "teachers"],
  syllabus_report: ["departments", "classes", "courses", "semesters"],
  overall_classes_summary: ["departments", "classes", "students", "teachers"],
  students: ["departments", "classes", "affiliations"],
  teachers: ["departments"],
  classes: ["departments", "affiliations"],
  semesters: ["departments", "classes", "courses"],
  allocations: ["departments", "classes", "teachers", "courses", "semesters"],
  timetables: ["departments", "classes", "teachers", "courses", "semesters", "allocations"],
  attendance: ["departments", "classes", "teachers"],
  student_attendance: ["departments", "classes", "semesters", "students"],
  daily_attendance: ["departments", "classes", "semesters", "students"],
  billing: ["departments", "classes", "teachers", "students", "allocations"],
  fines: ["students", "classes"],
  results: ["departments", "classes", "courses", "semesters", "students"],
  dept_attendance: ["departments", "classes"],
  course_attendance: ["departments", "classes", "courses", "semesters"],
  leave_management: ["departments", "classes", "students"],
  dit_mock: ["departments", "classes", "courses", "students"],
  rollno_slips: ["departments", "classes", "students"],
  notifications: ["departments", "classes"],
  feedback: ["classes", "students"],
};

const PORTAL_ROLE_PATH_MODULES: Partial<
  Record<UserRole, Record<string, PortalModule>>
> = {
  coordinator: {
    students: "students",
    semesters: "semesters",
    attendance: "attendance",
    "student-attendance": "student_attendance",
    billing: "billing",
    fines: "fines",
  },
  hod: {
    classes: "classes",
    students: "students",
    attendance: "student_attendance",
    "dept-attendance": "dept_attendance",
    results: "results",
    notifications: "notifications",
  },
};

export function portalModuleForRoleDashboard(
  role: UserRole,
  pathname: string,
  tab?: string | null,
): PortalModule | null {
  if (role === "coordinator" && pathname.startsWith("/dashboard/coordinator/")) {
    return PORTAL_ROLE_PATH_MODULES.coordinator?.[pathname.split("/")[3] ?? ""] ?? null;
  }
  if (role === "hod" && pathname === "/dashboard/hod/students") return "students";
  if (role === "hod" && pathname === "/dashboard/hod") {
    return PORTAL_ROLE_PATH_MODULES.hod?.[tab ?? "overview"] ?? null;
  }
  return null;
}

export function isPortalModule(value: string): value is PortalModule {
  return PORTAL_MODULES.some((module) => module.key === value);
}

export function isPortalManagedRole(value: string): value is PortalManagedRole {
  return PORTAL_MANAGED_ROLES.some((role) => role.key === value);
}