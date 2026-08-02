-- Campus Management System — Phase 12
-- Permanent Leave Management
--
-- 1. Adds 'permanent_leave' to the student_status enum
-- 2. Creates student_leaves table to track issued leaves with proof images

-- ── 1. Extend student_status enum ────────────────────────────────────────────
ALTER TYPE student_status ADD VALUE IF NOT EXISTS 'permanent_leave';

-- ── 2. Student Leaves table ───────────────────────────────────────────────────
-- One active leave per student (enforced by partial unique index below).
-- proof_urls: array of Cloudinary image URLs (up to 3).
-- revoked_at / revoked_by: set when leave is cancelled and student re-activated.
create table if not exists student_leaves (
  id           uuid         primary key default gen_random_uuid(),
  student_id   uuid         not null references students(id) on delete cascade,
  issue_date   date         not null,
  reason       text,
  notes        text,
  proof_urls   text[]       not null default '{}',
  issued_by    uuid         references users(id) on delete set null,
  revoked_at   timestamptz,
  revoked_by   uuid         references users(id) on delete set null,
  created_at   timestamptz  not null default now(),
  updated_at   timestamptz  not null default now()
);

-- Only one active (non-revoked) leave per student
create unique index if not exists idx_student_leaves_active
  on student_leaves(student_id)
  where revoked_at is null;

create index if not exists idx_student_leaves_student  on student_leaves(student_id);
create index if not exists idx_student_leaves_date     on student_leaves(issue_date);
