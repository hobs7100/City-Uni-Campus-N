-- Close only the semester-specific course legs. Never deactivate a shared
-- allocation, remove timetable cells, or change historical attendance/billing.
create or replace function complete_closed_semester_courses()
returns trigger language plpgsql as $$
begin
  if new.status = 'closed' then
    update semester_courses
    set syllabus_completed_at = coalesce(new.updated_at, now())
    where semester_id = new.id and syllabus_completed_at is null;
  end if;
  return new;
end;
$$;

create trigger semesters_complete_courses_on_close
after insert or update of status on semesters
for each row execute function complete_closed_semester_courses();

-- Repair all existing closed semesters, retaining previous completion metadata.
update semester_courses sc
set syllabus_completed_at = coalesce(s.updated_at, s.close_date::timestamptz, now())
from semesters s
where s.id = sc.semester_id and s.status = 'closed'
  and sc.syllabus_completed_at is null;

alter table classes add column starting_semester integer;
update classes set starting_semester = case when type = 'BS-Bridging' then 5 else 1 end;
alter table classes alter column starting_semester set not null;
alter table classes add constraint classes_starting_semester_range check (
  starting_semester between
    case when type = 'BS-Bridging' then 5 else 1 end
    and case when type = 'BS-Bridging' then 8 else total_semesters end
);

-- The user identified this existing late-entry cohort as starting at Semester 8.
-- Do not infer or change other no-history cohorts from their session dates.
update classes c set starting_semester = 8, updated_at = now()
where lower(regexp_replace(trim(c.class_name), '\s+', ' ', 'g')) = 'bs accounting & finance (bzu)'
  and c.session = '2022-26'
  and not exists (select 1 from semesters s where s.class_id = c.id);
