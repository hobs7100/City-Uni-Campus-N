import type { UserRole } from "@/lib/session";

export const PORTAL_MODULES = [
  {
    key: "students",
    label: "Students",
    description: "Student profiles, status changes, passwords, and removal",
  },
  {
    key: "teachers",
    label: "Teachers",
    description: "Teacher records, account details, passwords, and removal",
  },
  {
    key: "departments",
    label: "Faculties",
    description: "Faculty records and assigned HoD or coordinator",
  },
  {
    key: "classes",
    label: "Classes",
    description: "Class details, schemes of studies, and removal",
  },
  {
    key: "courses",
    label: "Course Catalog",
    description: "Catalog courses and course-outline files",
  },
  {
    key: "semesters",
    label: "Semesters",
    description: "Semester lifecycle, curriculum, and outlines",
  },
  {
    key: "allocations",
    label: "Allocations",
    description: "Teacher-course allocations and transfers",
  },
  {
    key: "timetables",
    label: "Timetables",
    description: "Timetable creation, slots, days, and course assignments",
  },
] as const;

export type PortalModule = (typeof PORTAL_MODULES)[number]["key"];
export type PortalAction = "edit" | "delete";

export const PORTAL_MANAGED_ROLES = [
  { key: "assistant", label: "Assistant" },
  { key: "coordinator", label: "Coordinator" },
  { key: "hod", label: "Head of Department" },
  { key: "finance_manager", label: "Finance Manager" },
] as const satisfies ReadonlyArray<{ key: UserRole; label: string }>;

export type PortalManagedRole = (typeof PORTAL_MANAGED_ROLES)[number]["key"];

export function isPortalModule(value: string): value is PortalModule {
  return PORTAL_MODULES.some((module) => module.key === value);
}

export function isPortalManagedRole(value: string): value is PortalManagedRole {
  return PORTAL_MANAGED_ROLES.some((role) => role.key === value);
}