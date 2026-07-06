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
