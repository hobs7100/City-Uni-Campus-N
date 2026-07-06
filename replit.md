# City College Campus Management System

## Overview
A full-stack Campus Management System for City College (University Campus), built in phases. Phase 1 covers Authentication and core academic structure management: Users, Affiliations, Departments, Classes, Students, and Teachers. Phase 2 adds Course Catalog and Semester Management. Phase 3 adds Allocation Management (assigning teachers to courses within active semesters, including combined-class allocations).

## Tech Stack
- **Framework**: Next.js (App Router, TypeScript) — frontend and backend (API routes) in one app
- **Styling**: Tailwind CSS v4
- **Database**: Supabase Postgres, accessed directly via the `pg` driver (not `supabase-js`) — raw SQL queries in `lib/db.ts`
- **File uploads**: Cloudinary (profile photos, documents)
- **Auth**: Custom auth (not Supabase Auth) — `iron-session` cookie sessions, bcrypt-hashed passwords, unified login that checks `users` → `teachers` → `students` tables by email
- **UI helpers**: react-select (searchable dropdowns), react-hot-toast, lucide-react icons, next-themes (dark mode)

## Architecture Notes
- **Database access**: All queries go through `lib/db.ts` (a pooled `pg.Pool`). `SUPABASE_DB_URL` must be the Connection Pooling (session mode) URI — `aws-0/1-<region>.pooler.supabase.com:5432` — because the direct `db.<project>.supabase.co` host is IPv6-only and unreachable from this environment.
- **Roles**: `admin`, `hod` (Head of Department), `coordinator`, `teacher`, `student`. Admin/HoD/Coordinator accounts live in the `users` table; teachers and students have their own tables with their own login credentials.
- **Route protection**: `middleware.ts` enforces that each role can only access `/dashboard/<role>/*`, and redirects unauthenticated users to `/login`.
- **Class semesters**: Auto-calculated from class type — ADP/DIT = 4 semesters, BS/LLB = 8 semesters (see `typeToSemesters` in `app/api/admin/classes/route.ts`).
- **Generated credentials**: When a student or teacher is created, a random password is generated and returned once in the API response (shown to the admin via toast) since there is no email delivery configured yet.
- **Soft deletes**: Students, teachers, and users use `deleted_at` for soft deletion; departments/classes/affiliations are hard-deleted (with FK-safety checks, e.g. a class can't be deleted while it has students).
- **Semesters**: Only one `active` semester per class is allowed at a time (enforced by a partial unique index on `semesters(class_id) where status = 'active'`, plus an app-level check). Starting a semester requires selecting courses from the department's catalog (`semester_courses` junction table); a course already used in any semester cannot be deleted from the catalog.
- **Allocations**: A course can only be allocated once per semester — enforced via a unique constraint on `allocation_semesters(semester_id, course_id)` (a denormalized `course_id` lives on the junction table specifically to make this possible). Combined allocations (one teacher + one course taught across multiple classes as a single lecture) insert one `allocation_semesters` row per involved semester under a single `allocations` row; the API validates every involved semester is active and has the chosen course in its catalog before inserting.

## Project Structure
- `db/migrations/` — SQL migrations; run via `node scripts/migrate.mjs`
- `scripts/seed-admin.mjs` — seeds the initial admin account
- `lib/` — shared server logic: `db.ts` (pg pool), `auth.ts` (hashing, unified login lookup), `session.ts` (iron-session config), `requireRole.ts` (API route guards), `cloudinary.ts`, `nav.ts` (role-based nav)
- `app/api/admin/*` — CRUD API routes for users, affiliations, departments, classes, students, teachers, courses, semesters, allocations
- `app/dashboard/<role>/*` — role-specific pages (admin has full management pages; hod/coordinator/teacher/student currently have overview pages, to be expanded in later phases)
- `components/ui/` — shared UI primitives (Modal, SearchableSelect, ConfirmDialog, StatusBadge)

## Default Admin Login
- Email: `admin@citycollege.edu.pk`
- Password: `Admin@12345`

## Current Status
**Phase 1 (complete)**: Auth flow, dashboard shell, User/Affiliation/Department/Class/Student/Teacher management (full CRUD) for Admin, per-role dashboard overview pages, Cloudinary photo upload for students.

**Phase 2 (complete)**: Course Catalog management (full CRUD, scoped to department, blocked from deletion once used in a semester) and Semester Management (Start Semester with course selection, Close Semester, history view; one active semester per class enforced at DB and app level).

**Phase 3 (complete)**: Allocation Management — assign a teacher to a course within a class's active semester (Workload/Per Credit Hour/Fixed rate types), with a "show all teachers" toggle to bypass department scoping, and combined-class allocations (one teacher + one course taught across multiple classes as a single lecture, validated so every combined class has an active semester with that course in its catalog). A course can only be allocated once per semester across the whole system.

Not yet built (future phases): timetables (with clash detection), teacher/student attendance, billing, exams/results, and the remaining modules from the full 18-module spec in `attached_assets/`.

## User Preferences
None recorded yet.
