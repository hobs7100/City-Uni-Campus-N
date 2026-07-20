-- Campus Management System — Phase 10
-- Teacher Course Transfer with History Preservation
--
-- Adds transfer lifecycle columns to allocations and removes the DB-level
-- unique constraint on allocation_semesters(semester_id, course_id) so that
-- a course can have a history chain of allocations (one active, rest transferred).
-- Application logic enforces the "single active allocation" invariant instead.

-- ── 1. New columns on allocations ─────────────────────────────────────────────
alter table allocations
  add column if not exists status text not null default 'active'
    check (status in ('active', 'transferred'));

alter table allocations
  add column if not exists started_at date;

alter table allocations
  add column if not exists end_date date;

-- Groups all allocations that are part of the same transfer chain.
alter table allocations
  add column if not exists transfer_group_id uuid;

-- Cumulative lectures delivered before this allocation started in the chain.
-- Teacher B's lecture numbers are displayed as lecture_seq_offset + local_count.
alter table allocations
  add column if not exists lecture_seq_offset integer not null default 0;

-- ── 2. Backfill existing rows ─────────────────────────────────────────────────
update allocations
set started_at = created_at::date
where started_at is null;

-- ── 3. Drop the DB-level unique constraint on allocation_semesters ────────────
-- This constraint prevented a second allocation row for the same course+semester,
-- which is exactly what a transfer creates. Application code now enforces
-- "only one active allocation per (semester_id, course_id)" in the transfer API.
alter table allocation_semesters
  drop constraint if exists allocation_semesters_semester_id_course_id_key;

-- ── 4. Helpful indexes ────────────────────────────────────────────────────────
create index if not exists idx_allocations_status
  on allocations(status);

create index if not exists idx_allocations_transfer_group
  on allocations(transfer_group_id)
  where transfer_group_id is not null;
