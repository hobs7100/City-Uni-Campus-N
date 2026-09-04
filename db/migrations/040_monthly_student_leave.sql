alter table student_leaves
  add column if not exists leave_start_date date,
  add column if not exists leave_end_date date;

alter table student_leaves drop constraint if exists student_leaves_type_check;
alter table student_leaves
  add constraint student_leaves_type_check
  check (leave_type in ('permanent', 'partial', 'monthly'));

alter table student_leaves drop constraint if exists student_leaves_partial_days_check;
alter table student_leaves drop constraint if exists student_leaves_type_details_check;
alter table student_leaves
  add constraint student_leaves_type_details_check
  check (
    (leave_type = 'permanent' and partial_days_per_week is null and leave_start_date is null and leave_end_date is null)
    or
    (leave_type = 'partial' and partial_days_per_week in (2, 3) and leave_start_date is null and leave_end_date is null)
    or
    (leave_type = 'monthly' and partial_days_per_week is null and leave_start_date is not null
      and leave_end_date is not null and leave_start_date <= leave_end_date)
  );

-- Permanent and partial leaves remain open-ended until revoked. Monthly leaves
-- expire by date and may be issued again once the previous range has ended.
drop index if exists idx_student_leaves_active;
drop index if exists uq_student_leaves_one_active;
create unique index if not exists idx_student_leaves_open_ended_active
  on student_leaves(student_id)
  where revoked_at is null and leave_type in ('permanent', 'partial');

create index if not exists idx_student_leaves_monthly_range
  on student_leaves(student_id, leave_start_date, leave_end_date)
  where revoked_at is null and leave_type = 'monthly';