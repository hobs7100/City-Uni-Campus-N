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
  | "Award"
  | "UserCog"
  | "Bell"
  | "FileSearch";

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
    { label: "Billing", href: "/dashboard/admin/billing", icon: "Wallet" },
    { label: "Exams & Results", href: "/dashboard/admin/results", icon: "Award" },
    { label: "Profile", href: "/dashboard/admin/profile", icon: "UserCog" },
  ],
  hod: [
    { label: "Overview", href: "/dashboard/hod?tab=overview", icon: "LayoutDashboard" },
    { label: "Classes", href: "/dashboard/hod?tab=classes", icon: "School" },
    { label: "Student Attendance", href: "/dashboard/hod?tab=attendance", icon: "ClipboardCheck" },
    { label: "Exam & Results", href: "/dashboard/hod?tab=results", icon: "Award" },
    { label: "Profile", href: "/dashboard/hod/profile", icon: "UserCog" },
  ],
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
    { label: "Profile", href: "/dashboard/admin/profile", icon: "UserCog" },
  ],
};

export const roleLabels: Record<UserRole, string> = {
  admin: "Administrator",
  hod: "Head of Department",
  coordinator: "Coordinator",
  teacher: "Teacher",
  student: "Student",
  finance_manager: "Finance Manager",
};
