alter table semester_courses
  add column if not exists syllabus_completed_at timestamptz,
  add column if not exists syllabus_completed_by uuid references users(id) on delete set null;

create index if not exists idx_semester_courses_syllabus_completion
  on semester_courses (semester_id, course_id)
  where syllabus_completed_at is not null;