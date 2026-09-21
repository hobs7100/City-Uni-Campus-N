alter table attendance_fine_adjustments
  add column if not exists cycle_started_at date;

update attendance_fine_adjustments afa
set cycle_started_at = coalesce(st.reactivated_at::date, date '1970-01-01')
from students st
where st.id = afa.student_id and afa.cycle_started_at is null;

alter table attendance_fine_adjustments
  alter column cycle_started_at set default date '1970-01-01',
  alter column cycle_started_at set not null;

alter table attendance_fine_adjustments
  drop constraint if exists attendance_fine_adjustments_student_id_semester_id_key,
  drop constraint if exists attendance_fine_adjustments_adjustment_type_check,
  drop constraint if exists attendance_fine_adjustments_check;

alter table attendance_fine_adjustments
  add constraint attendance_fine_adjustments_adjustment_type_check
    check (adjustment_type in ('discount', 'waive', 'clear')),
  add constraint attendance_fine_adjustments_action_amount_check
    check (
      (adjustment_type in ('waive', 'clear') and discount_amount = 0)
      or (adjustment_type = 'discount' and discount_amount > 0)
    );

drop index if exists idx_attendance_fine_adjustments_student;
create index if not exists idx_attendance_fine_adjustments_current
  on attendance_fine_adjustments(
    student_id,
    semester_id,
    cycle_started_at,
    created_at desc
  );

create or replace function reject_attendance_fine_adjustment_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Attendance fine adjustment history is append-only';
end;
$$;

drop trigger if exists trg_attendance_fine_adjustments_append_only
  on attendance_fine_adjustments;
create trigger trg_attendance_fine_adjustments_append_only
before update or delete on attendance_fine_adjustments
for each row execute function reject_attendance_fine_adjustment_mutation();