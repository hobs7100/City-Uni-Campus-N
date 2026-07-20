-- Campus Management System — Phase 11
-- DIT Mock Exam Module
--
-- Adds test series management and per-student mock exam result tracking
-- scoped specifically to DIT (Diploma in Information Technology) classes.

-- ── 1. Test Series ────────────────────────────────────────────────────────────
create table if not exists dit_test_series (
  id            uuid        primary key default gen_random_uuid(),
  name          varchar(200) not null,
  total_marks   integer      not null check (total_marks > 0),
  passing_marks integer      not null check (passing_marks >= 0),
  created_at    timestamptz  not null default now(),
  updated_at    timestamptz  not null default now()
);

-- ── 2. Mock Results ───────────────────────────────────────────────────────────
-- One row per student per (test_series, allocation, semester, test_date).
-- allocation_id → which teacher / which course delivered this test.
-- semester_id   → student's semester at time of submission.
-- submitted_by  → teacher_id who submitted the row.
create table if not exists dit_mock_results (
  id              uuid        primary key default gen_random_uuid(),
  test_series_id  uuid        not null references dit_test_series(id)  on delete restrict,
  allocation_id   uuid        not null references allocations(id)       on delete cascade,
  semester_id     uuid        not null references semesters(id)         on delete restrict,
  student_id      uuid        not null references students(id)          on delete cascade,
  test_date       date        not null,
  obtained_marks  integer     not null check (obtained_marks >= 0),
  remarks         text,
  submitted_by    uuid        not null references teachers(id)          on delete restrict,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (test_series_id, allocation_id, semester_id, student_id, test_date)
);

create index if not exists idx_dit_results_series     on dit_mock_results(test_series_id);
create index if not exists idx_dit_results_allocation on dit_mock_results(allocation_id);
create index if not exists idx_dit_results_student    on dit_mock_results(student_id);
create index if not exists idx_dit_results_semester   on dit_mock_results(semester_id);
create index if not exists idx_dit_results_date       on dit_mock_results(test_date);
