import type { UserRole } from "./session";
import { PORTAL_MODULES, type PortalModule } from "./portalPermissionsConfig";
import { getPortalAccessMap } from "./portalPermissions";

export type NavIconName =
  | "LayoutDashboard"
  | "Users"
  | "Landmark"
  | "Building2"
  | "School"
  | "GraduationCap"
  | "UsersRound"
  | "BookOpen"
  | "CalendarRange"
  | "ClipboardList"
  | "CalendarClock"
  | "UserCheck"
  | "ClipboardCheck"
  | "Wallet"
  | "Award"
  | "UserCog"
  | "Bell"
  | "FileSearch"
  | "PenLine"
  | "BarChart2"
  | "UserX"
  | "BookCheck"
  | "FileCheck2"
  | "ReceiptText"
  | "ShieldCheck"
  | "MessageSquare";

export interface NavItem {
  label: string;
  href: string;
  icon?: NavIconName;
}

export const navByRole: Record<UserRole, NavItem[]> = {
  admin: [
    { label: "Overview", href: "/dashboard/admin", icon: "LayoutDashboard" },
    { label: "Campus Report", href: "/dashboard/admin/campus-report", icon: "FileSearch" },
    { label: "Syllabus Report", href: "/dashboard/admin/syllabus-report", icon: "BookCheck" },
    { label: "Overall Classes Summary", href: "/dashboard/admin/overall-classes-summary", icon: "School" },
    { label: "Users", href: "/dashboard/admin/users", icon: "Users" },
    { label: "Portal Management", href: "/dashboard/admin/portal-management", icon: "ShieldCheck" },
    { label: "Affiliations", href: "/dashboard/admin/affiliations", icon: "Landmark" },
    { label: "Faculties", href: "/dashboard/admin/departments", icon: "Building2" },
    { label: "Classes", href: "/dashboard/admin/classes", icon: "School" },
    { label: "Students", href: "/dashboard/admin/students", icon: "GraduationCap" },
    { label: "Teachers", href: "/dashboard/admin/teachers", icon: "UsersRound" },
    { label: "Course Catalog", href: "/dashboard/admin/courses", icon: "BookOpen" },
    { label: "Semesters", href: "/dashboard/admin/semesters", icon: "CalendarRange" },
    { label: "Allocations", href: "/dashboard/admin/allocations", icon: "ClipboardList" },
    { label: "Timetables", href: "/dashboard/admin/timetables", icon: "CalendarClock" },
    { label: "Teacher Attendance", href: "/dashboard/admin/attendance", icon: "UserCheck" },
    {
      label: "Student Attendance",
      href: "/dashboard/admin/student-attendance",
      icon: "ClipboardCheck",
    },
    { label: "Daily Attendance", href: "/dashboard/admin/daily-student-attendance", icon: "ClipboardCheck" },
    { label: "Billing", href: "/dashboard/admin/billing", icon: "Wallet" },
    { label: "Fine", href: "/dashboard/admin/fines", icon: "Wallet" },
    { label: "Exams & Results", href: "/dashboard/admin/results", icon: "Award" },
    { label: "Dept. Attendance", href: "/dashboard/admin/dept-attendance", icon: "BarChart2" },
    { label: "Course Attendance", href: "/dashboard/admin/course-attendance", icon: "BookCheck" },
    { label: "Leave Management", href: "/dashboard/admin/leave-management", icon: "UserX" },
    { label: "DIT Mock Exam", href: "/dashboard/admin/dit-mock", icon: "PenLine" },
    { label: "Roll No. Slips", href: "/dashboard/admin/rollno-slips", icon: "FileCheck2" },
    { label: "LAT Slip", href: "/dashboard/admin/lat-slip", icon: "ReceiptText" },
    { label: "Notifications", href: "/dashboard/admin/notifications", icon: "Bell" },
    { label: "Feedback System", href: "/dashboard/admin/feedback", icon: "MessageSquare" },
    { label: "Profile", href: "/dashboard/admin/profile", icon: "UserCog" },
  ],
  hod: [
    { label: "Overview", href: "/dashboard/hod?tab=overview", icon: "LayoutDashboard" },
    { label: "Classes", href: "/dashboard/hod?tab=classes", icon: "School" },
    { label: "Students", href: "/dashboard/hod?tab=students", icon: "GraduationCap" },
    { label: "Student Attendance", href: "/dashboard/hod?tab=attendance", icon: "ClipboardCheck" },
    { label: "Dept. Attendance", href: "/dashboard/hod?tab=dept-attendance", icon: "BarChart2" },
    { label: "Exam & Results", href: "/dashboard/hod?tab=results", icon: "Award" },
    { label: "Roll No. Slips", href: "/dashboard/admin/rollno-slips", icon: "FileCheck2" },
    { label: "Notifications", href: "/dashboard/hod?tab=notifications", icon: "Bell" },
    { label: "Profile", href: "/dashboard/hod/profile", icon: "UserCog" },
  ],
  coordinator: [
    { label: "Overview", href: "/dashboard/coordinator", icon: "LayoutDashboard" },
    { label: "Students", href: "/dashboard/coordinator/students", icon: "GraduationCap" },
    { label: "Semesters", href: "/dashboard/coordinator/semesters", icon: "CalendarRange" },
    { label: "Teacher Attendance", href: "/dashboard/coordinator/attendance", icon: "UserCheck" },
    {
      label: "Student Attendance",
      href: "/dashboard/coordinator/student-attendance",
      icon: "ClipboardCheck",
    },
    { label: "Billing", href: "/dashboard/coordinator/billing", icon: "Wallet" },
    { label: "Fine", href: "/dashboard/coordinator/fines", icon: "Wallet" },
    { label: "Profile", href: "/dashboard/coordinator/profile", icon: "UserCog" },
  ],
  teacher: [
    { label: "Overview", href: "/dashboard/teacher?tab=overview", icon: "LayoutDashboard" },
    { label: "My Courses", href: "/dashboard/teacher?tab=courses", icon: "BookOpen" },
    { label: "Timetable", href: "/dashboard/teacher?tab=timetable", icon: "CalendarClock" },
    { label: "Mark Attendance", href: "/dashboard/teacher?tab=mark", icon: "ClipboardCheck" },
    { label: "My Attendance", href: "/dashboard/teacher?tab=report", icon: "UserCheck" },
    { label: "Student Attendance", href: "/dashboard/teacher?tab=students", icon: "GraduationCap" },
    { label: "Notifications", href: "/dashboard/teacher?tab=notifications", icon: "Bell" },
    { label: "Profile", href: "/dashboard/teacher?tab=profile", icon: "UserCog" },
  ],
  student: [{ label: "Overview", href: "/dashboard/student", icon: "LayoutDashboard" }],
  finance_manager: [
    { label: "Overview", href: "/dashboard/admin", icon: "LayoutDashboard" },
    { label: "Classes", href: "/dashboard/admin/classes", icon: "School" },
    { label: "Faculties", href: "/dashboard/admin/departments", icon: "Building2" },
    { label: "Teachers", href: "/dashboard/admin/teachers", icon: "UsersRound" },
    { label: "Allocations", href: "/dashboard/admin/allocations", icon: "ClipboardList" },
    { label: "Timetables", href: "/dashboard/admin/timetables", icon: "CalendarClock" },
    { label: "Teacher Attendance", href: "/dashboard/admin/attendance", icon: "UserCheck" },
    { label: "Billing", href: "/dashboard/admin/billing", icon: "Wallet" },
    { label: "Fine", href: "/dashboard/admin/fines", icon: "Wallet" },
    { label: "Profile", href: "/dashboard/admin/profile", icon: "UserCog" },
    // Roll No. Slips intentionally excluded for Finance Manager
  ],
  assistant: [
    { label: "Overview", href: "/dashboard/admin", icon: "LayoutDashboard" },
    { label: "Campus Report", href: "/dashboard/admin/campus-report", icon: "FileSearch" },
    { label: "Syllabus Report", href: "/dashboard/admin/syllabus-report", icon: "BookCheck" },
    { label: "Affiliations", href: "/dashboard/admin/affiliations", icon: "Landmark" },
    { label: "Faculties", href: "/dashboard/admin/departments", icon: "Building2" },
    { label: "Classes", href: "/dashboard/admin/classes", icon: "School" },
    { label: "Students", href: "/dashboard/admin/students", icon: "GraduationCap" },
    { label: "Teachers", href: "/dashboard/admin/teachers", icon: "UsersRound" },
    { label: "Course Catalog", href: "/dashboard/admin/courses", icon: "BookOpen" },
    { label: "Semesters", href: "/dashboard/admin/semesters", icon: "CalendarRange" },
    { label: "Allocations", href: "/dashboard/admin/allocations", icon: "ClipboardList" },
    { label: "Timetables", href: "/dashboard/admin/timetables", icon: "CalendarClock" },
    { label: "Teacher Attendance", href: "/dashboard/admin/attendance", icon: "UserCheck" },
    { label: "Student Attendance", href: "/dashboard/admin/student-attendance", icon: "ClipboardCheck" },
    { label: "Daily Attendance", href: "/dashboard/admin/daily-student-attendance", icon: "ClipboardCheck" },
    { label: "Billing", href: "/dashboard/admin/billing", icon: "Wallet" },
    { label: "Exams & Results", href: "/dashboard/admin/results", icon: "Award" },
    { label: "Dept. Attendance", href: "/dashboard/admin/dept-attendance", icon: "BarChart2" },
    { label: "Course Attendance", href: "/dashboard/admin/course-attendance", icon: "BookCheck" },
    { label: "Leave Management", href: "/dashboard/admin/leave-management", icon: "UserX" },
    { label: "DIT Mock Exam", href: "/dashboard/admin/dit-mock", icon: "PenLine" },
    { label: "Notifications", href: "/dashboard/admin/notifications", icon: "Bell" },
    { label: "Profile", href: "/dashboard/admin/profile", icon: "UserCog" },
    // Roll No. Slips intentionally excluded for Assistant
  ],
};

export const roleLabels: Record<UserRole, string> = {
  admin: "Administrator",
  hod: "Head of Department",
  coordinator: "Coordinator",
  teacher: "Teacher",
  student: "Student",
  finance_manager: "Finance Manager",
  assistant: "Assistant",
};

const managedRoleRoutes: Partial<Record<UserRole, Partial<Record<PortalModule, string>>>> = {
  hod: {
    classes: "/dashboard/hod?tab=classes",
    students: "/dashboard/hod?tab=students",
    student_attendance: "/dashboard/hod?tab=attendance",
    dept_attendance: "/dashboard/hod?tab=dept-attendance",
    results: "/dashboard/hod?tab=results",
    rollno_slips: "/dashboard/admin/rollno-slips",
    notifications: "/dashboard/hod?tab=notifications",
  },
  coordinator: {
    students: "/dashboard/coordinator/students",
    semesters: "/dashboard/coordinator/semesters",
    attendance: "/dashboard/coordinator/attendance",
    student_attendance: "/dashboard/coordinator/student-attendance",
    billing: "/dashboard/coordinator/billing",
    fines: "/dashboard/coordinator/fines",
  },
};

/**
 * Builds navigation from the canonical registry and persisted portal grants.
 * Existing role-specific routes are preferred; newly granted modules fall
 * back to their admin page so a grant is immediately usable.
 */
export async function getDashboardNavigation(role: UserRole): Promise<NavItem[]> {
  if (role === "admin") return navByRole.admin;
  if (!["assistant", "coordinator", "hod", "finance_manager"].includes(role)) {
    return navByRole[role];
  }

  const access = await getPortalAccessMap(role);
  const base = navByRole[role].filter(
    (item) => item.label === "Overview" || item.label === "Profile",
  );
  const roleRoutes = managedRoleRoutes[role] ?? {};
  const granted = PORTAL_MODULES.filter((module) => access.get(module.key)?.canView === true).map(
    (module) => ({
      label: module.label,
      href: roleRoutes[module.key] ?? module.adminHref,
      icon: module.icon as NavIconName,
    }),
  );

  return [...base.slice(0, 1), ...granted, ...base.slice(1)];
}
