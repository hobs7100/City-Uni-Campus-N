import type { UserRole } from "./session";

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
  | "Award";

export interface NavItem {
  label: string;
  href: string;
  icon?: NavIconName;
}

export const navByRole: Record<UserRole, NavItem[]> = {
  admin: [
    { label: "Overview", href: "/dashboard/admin", icon: "LayoutDashboard" },
    { label: "Users", href: "/dashboard/admin/users", icon: "Users" },
    { label: "Affiliations", href: "/dashboard/admin/affiliations", icon: "Landmark" },
    { label: "Departments", href: "/dashboard/admin/departments", icon: "Building2" },
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
    { label: "Billing", href: "/dashboard/admin/billing", icon: "Wallet" },
    { label: "Exams & Results", href: "/dashboard/admin/results", icon: "Award" },
  ],
  hod: [{ label: "Overview", href: "/dashboard/hod", icon: "LayoutDashboard" }],
  coordinator: [
    { label: "Overview", href: "/dashboard/coordinator", icon: "LayoutDashboard" },
    { label: "Classes", href: "/dashboard/coordinator/classes", icon: "School" },
    { label: "Students", href: "/dashboard/coordinator/students", icon: "GraduationCap" },
    { label: "Teacher Attendance", href: "/dashboard/coordinator/attendance", icon: "UserCheck" },
    {
      label: "Student Attendance",
      href: "/dashboard/coordinator/student-attendance",
      icon: "ClipboardCheck",
    },
    { label: "Billing", href: "/dashboard/coordinator/billing", icon: "Wallet" },
  ],
  teacher: [{ label: "Overview", href: "/dashboard/teacher", icon: "LayoutDashboard" }],
  student: [{ label: "Overview", href: "/dashboard/student", icon: "LayoutDashboard" }],
};

export const roleLabels: Record<UserRole, string> = {
  admin: "Administrator",
  hod: "Head of Department",
  coordinator: "Coordinator",
  teacher: "Teacher",
  student: "Student",
};
