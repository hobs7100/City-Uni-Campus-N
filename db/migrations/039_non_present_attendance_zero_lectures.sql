-- Non-present statuses do not represent a delivered lecture and must never
-- contribute to faculty billing totals.
alter type attendance_status add value if not exists 'absent';

update attendance_records
set lecture_count = 0,
    updated_at = now()
where status <> 'ok'
  and lecture_count <> 0
  and bill_item_id is null;

alter table attendance_records
  drop constraint if exists attendance_records_non_present_zero_lectures_check;

alter table attendance_records
  add constraint attendance_records_non_present_zero_lectures_check
  check (status = 'ok' or lecture_count = 0);