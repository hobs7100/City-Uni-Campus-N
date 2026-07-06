import type { UserRole } from "./session";

export interface NavItem {
  label: string;
  href: string;
}

export const navByRole: Record<UserRole, NavItem[]> = {
  admin: [
    { label: "Overview", href: "/dashboard/admin" },
    { label: "Users", href: "/dashboard/admin/users" },
    { label: "Affiliations", href: "/dashboard/admin/affiliations" },
    { label: "Departments", href: "/dashboard/admin/departments" },
    { label: "Classes", href: "/dashboard/admin/classes" },
    { label: "Students", href: "/dashboard/admin/students" },
    { label: "Teachers", href: "/dashboard/admin/teachers" },
    { label: "Course Catalog", href: "/dashboard/admin/courses" },
    { label: "Semesters", href: "/dashboard/admin/semesters" },
    { label: "Allocations", href: "/dashboard/admin/allocations" },
    { label: "Timetables", href: "/dashboard/admin/timetables" },
    { label: "Teacher Attendance", href: "/dashboard/admin/attendance" },
    { label: "Student Attendance", href: "/dashboard/admin/student-attendance" },
    { label: "Billing", href: "/dashboard/admin/billing" },
    { label: "Exams & Results", href: "/dashboard/admin/results" },
  ],
  hod: [
    { label: "Overview", href: "/dashboard/hod" },
    { label: "Departments", href: "/dashboard/hod/departments" },
    { label: "Students", href: "/dashboard/hod/students" },
    { label: "Teachers", href: "/dashboard/hod/teachers" },
  ],
  coordinator: [
    { label: "Overview", href: "/dashboard/coordinator" },
    { label: "Classes", href: "/dashboard/coordinator/classes" },
    { label: "Students", href: "/dashboard/coordinator/students" },
    { label: "Teacher Attendance", href: "/dashboard/coordinator/attendance" },
    { label: "Student Attendance", href: "/dashboard/coordinator/student-attendance" },
    { label: "Billing", href: "/dashboard/coordinator/billing" },
  ],
  teacher: [{ label: "Overview", href: "/dashboard/teacher" }],
  student: [{ label: "Overview", href: "/dashboard/student" }],
};

export const roleLabels: Record<UserRole, string> = {
  admin: "Administrator",
  hod: "Head of Department",
  coordinator: "Coordinator",
  teacher: "Teacher",
  student: "Student",
};
