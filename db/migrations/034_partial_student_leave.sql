alter table student_leaves
  add column if not exists leave_type varchar(20) not null default 'permanent',
  add column if not exists partial_days_per_week smallint;

alter table student_leaves
  add constraint student_leaves_type_check
  check (leave_type in ('permanent', 'partial'));

alter table student_leaves
  add constraint student_leaves_partial_days_check
  check (
    (leave_type = 'permanent' and partial_days_per_week is null)
    or
    (leave_type = 'partial' and partial_days_per_week in (2, 3))
  );

create index if not exists idx_student_leaves_active_type
  on student_leaves(student_id, leave_type)
  where revoked_at is null;