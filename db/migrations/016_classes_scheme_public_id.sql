alter table classes add column if not exists scheme_public_id text;
alter table classes add column if not exists scheme_resource_type text default 'image';
