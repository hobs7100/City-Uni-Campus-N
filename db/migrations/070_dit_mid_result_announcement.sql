-- Existing and future Mid-Term series start hidden from students.
-- Other DIT assessments and all non-DIT result paths remain unchanged.
alter table dit_test_series
  add column mid_result_announced_at timestamptz,
  add column mid_result_announced_by uuid references users(id) on delete set null;
