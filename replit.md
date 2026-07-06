# City College Campus Management System

## Overview
A full-stack Campus Management System for City College (University Campus), built in phases. Phase 1 covers Authentication and core academic structure management: Users, Affiliations, Departments, Classes, Students, and Teachers. Phase 2 adds Course Catalog and Semester Management. Phase 3 adds Allocation Management (assigning teachers to courses within active semesters, including combined-class allocations). Phase 4 adds Timetable Management with teacher clash detection.

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
- **Allocations**: A course can only be allocated once per semester — enforced via a unique constraint on `allocation_semesters(semester_id, course_id)` (a denormalized `course_id` lives on the junction table specifically to make this possible). Combined allocations (one teacher + one course taught across multiple classes as a single lecture) insert one `allocation_semesters` row per involved semester under a single `allocations` row; the API validates the primary semester is active and has the chosen course in its catalog, and every combined semester is active — if a combined semester doesn't yet have the course in its catalog, it's auto-added rather than rejected (the course is being taught there by definition of the combined lecture).
- **Semester editing**: Active (not closed) semesters can have their term type/start date edited (`PATCH /api/admin/semesters/[id]` with `term_type`/`start_date` body — distinct from the same endpoint's `close_date` close action) and their curriculum courses managed post-creation via `POST /api/admin/semesters/[id]/courses` (add) and `DELETE /api/admin/semesters/[id]/courses/[courseId]` (remove, blocked if the course already has a teacher allocated in that semester).
- **Timetables**: One timetable per class+semester (`timetables`, unique on `class_id, semester_id`). Grid is normalized into `timetable_days` (rows) x `timetable_periods` (columns) x `timetable_cells` (intersection, holds a nullable `allocation_id`); adding/removing a day or period fans out/collapses the cross-product of cells. Filling a cell runs a teacher clash check: blocks if another cell (any timetable) shares the same day name and an overlapping period time range with the same teacher via a *different* `allocation_id`; the exact same `allocation_id` (a genuine combined-class lecture) is exempt and can be placed in multiple timetables at the identical slot.

## Project Structure
- `db/migrations/` — SQL migrations; run via `node scripts/migrate.mjs`
- `scripts/seed-admin.mjs` — seeds the initial admin account
- `lib/` — shared server logic: `db.ts` (pg pool), `auth.ts` (hashing, unified login lookup), `session.ts` (iron-session config), `requireRole.ts` (API route guards), `cloudinary.ts`, `nav.ts` (role-based nav)
- `app/api/admin/*` — CRUD API routes for users, affiliations, departments, classes, students, teachers, courses, semesters, allocations, timetables
- `app/dashboard/<role>/*` — role-specific pages (admin has full management pages; hod/coordinator/teacher/student currently have overview pages, to be expanded in later phases)
- `components/ui/` — shared UI primitives (Modal, SearchableSelect, ConfirmDialog, StatusBadge)

## Default Admin Login
- Email: `admin@citycollege.edu.pk`
- Password: `Admin@12345`

## Current Status
**Phase 1 (complete)**: Auth flow, dashboard shell, User/Affiliation/Department/Class/Student/Teacher management (full CRUD) for Admin, per-role dashboard overview pages, Cloudinary photo upload for students.

**Phase 2 (complete)**: Course Catalog management (full CRUD, scoped to department, blocked from deletion once used in a semester) and Semester Management (Start Semester with course selection, Close Semester, Edit active semester's term/start date + curriculum courses, history view; one active semester per class enforced at DB and app level).

**Phase 3 (complete)**: Allocation Management — assign a teacher to a course within a class's active semester (Workload/Per Credit Hour/Fixed rate types), with a "show all teachers" toggle to bypass department scoping, and combined-class allocations (one teacher + one course taught across multiple classes as a single lecture; every combined class must have an active semester, and the course is auto-added to a combined semester's catalog if not already present). A course can only be allocated once per semester across the whole system.

**Phase 4 (complete)**: Timetable Management — create a timetable for a class's active semester (Morning/Evening shift, W.e.f. date), auto-seeded with a default Mon–Fri x hourly-slot grid; admin can add/remove days and time-slot columns. Each empty cell offers a picker of that semester's allocations (course + teacher) to fill in, displaying the course title and teacher name; filling a cell runs a teacher clash check across all timetables (same teacher, same day, overlapping time in a different class = blocked), with a specific exemption for true combined-class lectures (same allocation placed in multiple timetables at the identical slot is allowed). Includes a colorful, Landscape-oriented print/PDF grid view.

Not yet built (future phases): teacher/student attendance, billing, exams/results, and the remaining modules from the full 18-module spec in `attached_assets/`.

## User Preferences
None recorded yet.
