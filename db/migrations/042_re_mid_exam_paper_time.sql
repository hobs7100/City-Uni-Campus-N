-- Add an optional paper start time to Re-Mid Exam date sheets.
alter table re_mid_exam_datesheets
  add column if not exists paper_time time without time zone;
