-- Add course outline file storage to semester_courses
alter table semester_courses
  add column if not exists course_outline_url   varchar,
  add column if not exists course_outline_public_id varchar;
