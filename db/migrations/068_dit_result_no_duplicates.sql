-- A test series represents one assessment per allocation/semester/student.
-- The exam date is editable metadata, not permission to create another result.
lock table dit_mock_results in access exclusive mode;

-- Preserve the full older rows before removing them from active results.
create table if not exists dit_mock_result_duplicates_archive (
  like dit_mock_results including defaults,
  archived_at timestamptz not null default now(),
  primary key (id)
);

create temporary table dit_duplicate_result_ids on commit drop as
select id from (
  select id, row_number() over (
    partition by test_series_id, allocation_id, semester_id, student_id
    order by updated_at desc, created_at desc, id desc
  ) as position
  from dit_mock_results
) ranked where position > 1;

insert into dit_mock_result_duplicates_archive
  (id, test_series_id, allocation_id, semester_id, student_id, test_date,
   obtained_marks, is_absent, remarks, submitted_by, created_at, updated_at)
select d.id, d.test_series_id, d.allocation_id, d.semester_id, d.student_id,
       d.test_date, d.obtained_marks, d.is_absent, d.remarks, d.submitted_by,
       d.created_at, d.updated_at
from dit_mock_results d join dit_duplicate_result_ids dup on dup.id = d.id
on conflict (id) do nothing;

delete from dit_mock_results d using dit_duplicate_result_ids dup where d.id = dup.id;

alter table dit_mock_results
  drop constraint dit_mock_results_test_series_id_allocation_id_semester_id_s_key,
  add constraint dit_mock_results_assessment_student_key
    unique (test_series_id, allocation_id, semester_id, student_id);
