-- Correct installations that applied migration 055 before historical
-- adjustment cycles were assigned independently.
drop trigger if exists trg_attendance_fine_adjustments_append_only
  on attendance_fine_adjustments;

with stale_cycles as (
  select afa.student_id, afa.cycle_started_at, gen_random_uuid() as cycle_id
  from attendance_fine_adjustments afa
  join students st on st.id = afa.student_id
  where afa.cycle_started_at <> coalesce(
    st.attendance_fine_cycle_started_at,
    date '1970-01-01'
  )
  group by afa.student_id, afa.cycle_started_at
)
update attendance_fine_adjustments afa
set assessment_cycle_id = sc.cycle_id
from stale_cycles sc
where sc.student_id = afa.student_id
  and sc.cycle_started_at = afa.cycle_started_at;

update attendance_fine_adjustments afa
set assessment_cycle_id = st.attendance_fine_cycle_id
from students st
where st.id = afa.student_id
  and afa.cycle_started_at = coalesce(
    st.attendance_fine_cycle_started_at,
    date '1970-01-01'
  );

create trigger trg_attendance_fine_adjustments_append_only
before update or delete on attendance_fine_adjustments
for each row execute function reject_attendance_fine_adjustment_mutation();