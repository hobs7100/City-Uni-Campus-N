-- Class names containing "Bridging" are Post-ADP programs with semesters 5-8.
update classes
set type = 'BS-Bridging',
    total_semesters = 4,
    updated_at = now()
where class_name ilike '%Bridging%'
   or type = 'BS-Bridging';

-- Preserve semester row identities and every dependent FK while moving legacy
-- Bridging semester numbers 1-4 to their correct 5-8 range.
update semesters s
set semester_number = s.semester_number + 4,
    updated_at = now()
from classes c
where c.id = s.class_id
  and c.type = 'BS-Bridging'
  and s.semester_number between 1 and 4;