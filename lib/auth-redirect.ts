import type { UserRole } from "./session";

export const roleHomePage: Record<UserRole, string> = {
  admin: "/dashboard/admin",
  hod: "/dashboard/hod",
  coordinator: "/dashboard/coordinator",
  teacher: "/dashboard/teacher",
  student: "/dashboard/student",
  finance_manager: "/dashboard/admin",
  assistant: "/dashboard/admin",
  suprident: "/dashboard/employee",
  controller: "/dashboard/employee",
  accountant: "/dashboard/employee",
};
