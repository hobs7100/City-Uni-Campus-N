-- Store one shared outline on each catalog course so every allocation can use it.
alter table courses
  add column if not exists course_outline_url varchar,
  add column if not exists course_outline_public_id varchar;