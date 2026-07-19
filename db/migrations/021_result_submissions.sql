-- Migration 021: Track teacher result submissions per course-semester
create table if not exists result_submissions (
  id           uuid        primary key default gen_random_uuid(),
  semester_id  uuid        not null references semesters(id)  on delete cascade,
  course_id    uuid        not null references courses(id)    on delete cascade,
  teacher_id   uuid        references teachers(id) on delete set null,
  status       varchar(20) not null default 'pending',
  submitted_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (semester_id, course_id)
);

create index if not exists idx_result_submissions_semester on result_submissions(semester_id);
create index if not exists idx_result_submissions_course   on result_submissions(course_id);
create index if not exists idx_result_submissions_teacher  on result_submissions(teacher_id);
