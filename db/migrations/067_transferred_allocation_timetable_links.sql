-- Timetable cells describe the current recurring schedule, but legacy saves
-- could put a transferred allocation back into it. Resolve only unambiguous
-- successors in the SAME transfer chain, course and active semester.
-- Attendance, billing and closed-semester timetable history remain untouched.
with candidates as (
  select tc.id as cell_id, current_allocation.id as allocation_id,
         count(*) over (partition by tc.id) as candidate_count
  from timetable_cells tc
  join timetables tt on tt.id = tc.timetable_id
  join semesters s on s.id = tt.semester_id and s.status = 'active'
  join allocations previous on previous.id = tc.allocation_id
                           and previous.status = 'transferred'
  join allocations current_allocation
    on current_allocation.transfer_group_id = previous.transfer_group_id
   and current_allocation.course_id = previous.course_id
   and current_allocation.status = 'active'
  join allocation_semesters als
    on als.allocation_id = current_allocation.id
   and als.semester_id = tt.semester_id
   and als.course_id = current_allocation.course_id
)
update timetable_cells tc
set allocation_id = c.allocation_id, updated_at = now()
from candidates c
where tc.id = c.cell_id and c.candidate_count = 1;
