-- Campus-wide Mock Exam date sheets, independent of Mid Exam and DIT Mock data.
-- Depends on semesters and courses from the core catalog migrations.
create table if not exists mock_exam_datesheets (
  id                   uuid primary key default gen_random_uuid(),
  semester_id          uuid not null references semesters(id) on delete cascade,
  course_id            uuid not null references courses(id)   on delete cascade,
  paper_date           date,
  paper_time           time without time zone,
  bundle_received_date date,
  return_date          date,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (semester_id, course_id)
);

create index if not exists idx_mock_exam_datesheets_semester on mock_exam_datesheets(semester_id);
create index if not exists idx_mock_exam_datesheets_course   on mock_exam_datesheets(course_id);