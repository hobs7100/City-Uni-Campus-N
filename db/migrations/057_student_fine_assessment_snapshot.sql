alter table student_fines
  drop constraint if exists student_fines_amount_check;

alter table student_fines
  add constraint student_fines_amount_check check (amount >= 0),
  add column if not exists gross_amount numeric(12,2),
  add column if not exists discount_amount numeric(12,2) not null default 0,
  add column if not exists adjustment_type varchar(20),
  add column if not exists assessment_cycle_id uuid;

update student_fines
set gross_amount = amount
where gross_amount is null;

alter table student_fines
  alter column gross_amount set not null;

alter table student_fines
  drop constraint if exists student_fines_adjustment_type_check,
  add constraint student_fines_adjustment_type_check
    check (adjustment_type is null or adjustment_type in ('discount', 'waive'));

create index if not exists idx_student_fines_assessment_cycle
  on student_fines(student_id, assessment_cycle_id);