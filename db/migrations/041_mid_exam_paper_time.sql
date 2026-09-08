-- Add an optional paper start time to Mid Exam date sheets.
alter table mid_exam_datesheets
  add column if not exists paper_time time without time zone;
