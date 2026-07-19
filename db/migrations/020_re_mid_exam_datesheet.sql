-- Migration 020: Re-Mid Exam Datesheet table
create table if not exists re_mid_exam_datesheets (
  id                   uuid primary key default gen_random_uuid(),
  semester_id          uuid not null references semesters(id) on delete cascade,
  course_id            uuid not null references courses(id)   on delete cascade,
  paper_date           date,
  bundle_received_date date,
  return_date          date,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (semester_id, course_id)
);
