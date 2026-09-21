alter table students
  add column if not exists attendance_fine_cycle_id uuid
    not null default gen_random_uuid(),
  add column if not exists attendance_fine_cycle_started_at date;

update students
set attendance_fine_cycle_started_at = reactivated_at::date
where reactivated_at is not null
  and attendance_fine_cycle_started_at is null;

alter table attendance_fine_adjustments
  add column if not exists assessment_cycle_id uuid;

drop trigger if exists trg_attendance_fine_adjustments_append_only
  on attendance_fine_adjustments;

update attendance_fine_adjustments afa
set assessment_cycle_id = st.attendance_fine_cycle_id
from students st
where st.id = afa.student_id
  and afa.cycle_started_at = coalesce(
    st.attendance_fine_cycle_started_at,
    date '1970-01-01'
  )
  and afa.assessment_cycle_id is null;

with historical_cycles as (
  select student_id, cycle_started_at, gen_random_uuid() as cycle_id
  from attendance_fine_adjustments
  where assessment_cycle_id is null
  group by student_id, cycle_started_at
)
update attendance_fine_adjustments afa
set assessment_cycle_id = hc.cycle_id
from historical_cycles hc
where hc.student_id = afa.student_id
  and hc.cycle_started_at = afa.cycle_started_at
  and afa.assessment_cycle_id is null;

alter table attendance_fine_adjustments
  alter column assessment_cycle_id set not null;

create trigger trg_attendance_fine_adjustments_append_only
before update or delete on attendance_fine_adjustments
for each row execute function reject_attendance_fine_adjustment_mutation();

drop index if exists idx_attendance_fine_adjustments_current;
create index if not exists idx_attendance_fine_adjustments_current
  on attendance_fine_adjustments(
    student_id,
    semester_id,
    assessment_cycle_id,
    created_at desc
  );