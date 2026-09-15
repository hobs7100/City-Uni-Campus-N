create sequence if not exists lat_slip_fid_seq start 1;

create table if not exists lat_slips (
  id uuid primary key default gen_random_uuid(),
  fid bigint not null unique default nextval('lat_slip_fid_seq'),
  student_name varchar(200) not null,
  father_name varchar(200) not null,
  program varchar(200) not null,
  academic_year integer not null check (academic_year between 2000 and 2100),
  batch varchar(20) not null check (batch in ('Batch-1', 'Batch-2', 'Batch-3', 'Batch-4', 'Batch-5')),
  admission_fee numeric(12,2) not null default 0 check (admission_fee >= 0),
  lat_fee numeric(12,2) not null default 0 check (lat_fee >= 0),
  other_charges numeric(12,2) not null default 0 check (other_charges >= 0),
  total_amount numeric(12,2) generated always as (admission_fee + lat_fee + other_charges) stored,
  generated_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_lat_slips_created_at on lat_slips(created_at desc);
create index if not exists idx_lat_slips_batch on lat_slips(batch);
create index if not exists idx_lat_slips_student_name on lat_slips(lower(student_name));