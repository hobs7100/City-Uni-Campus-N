# City College Campus Management System

## Overview
A full-stack Campus Management System for City College (University Campus), built in phases. Phase 1 covers Authentication and core academic structure management: Users, Affiliations, Departments, Classes, Students, and Teachers.

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

## Project Structure
- `db/migrations/` — SQL migrations; run via `node scripts/migrate.mjs`
- `scripts/seed-admin.mjs` — seeds the initial admin account
- `lib/` — shared server logic: `db.ts` (pg pool), `auth.ts` (hashing, unified login lookup), `session.ts` (iron-session config), `requireRole.ts` (API route guards), `cloudinary.ts`, `nav.ts` (role-based nav)
- `app/api/admin/*` — CRUD API routes for users, affiliations, departments, classes, students, teachers
- `app/dashboard/<role>/*` — role-specific pages (admin has full management pages; hod/coordinator/teacher/student currently have overview pages, to be expanded in later phases)
- `components/ui/` — shared UI primitives (Modal, SearchableSelect, ConfirmDialog, StatusBadge)

## Default Admin Login
- Email: `admin@citycollege.edu.pk`
- Password: `Admin@12345`

## Current Status (Phase 1)
Completed: Auth flow, dashboard shell, User/Affiliation/Department/Class/Student/Teacher management (full CRUD) for Admin, per-role dashboard overview pages, Cloudinary photo upload for students.

Not yet built (future phases): attendance, exams/results, fee management, timetables, and the other modules from the full 18-module spec in `attached_assets/`.

## User Preferences
None recorded yet.
