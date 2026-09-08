-- Track DIT mock-exam absences explicitly. Existing result rows remain present.
alter table dit_mock_results
  add column if not exists is_absent boolean not null default false;