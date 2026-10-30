-- Exam-only grouping. Never change students.class_id or attendance ownership.
create table dit_exam_sections (
  id uuid primary key default gen_random_uuid(),
  name varchar(150) not null check (length(btrim(name)) > 0),
  date date not null,
  created_by uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create unique index dit_exam_sections_name_key on dit_exam_sections (lower(btrim(name)));

create table dit_exam_section_memberships (
  student_id uuid primary key references students(id) on delete restrict,
  exam_section_id uuid not null references dit_exam_sections(id) on delete restrict,
  changed_by uuid not null references users(id) on delete restrict,
  assigned_at timestamptz not null default now()
);
create index dit_exam_section_memberships_section_idx on dit_exam_section_memberships(exam_section_id);

create table dit_exam_section_history (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete restrict,
  from_section_id uuid references dit_exam_sections(id) on delete restrict,
  to_section_id uuid not null references dit_exam_sections(id) on delete restrict,
  changed_by uuid not null references users(id) on delete restrict,
  changed_at timestamptz not null default clock_timestamp()
);
create index dit_exam_section_history_student_idx on dit_exam_section_history(student_id, changed_at);

create function record_dit_exam_section_move() returns trigger language plpgsql as $$
begin
  if not exists (
    select 1 from students s join classes c on c.id = s.class_id
    where s.id = new.student_id and c.type = 'DIT' and s.deleted_at is null
  ) then
    raise exception 'Exam sections are only available to non-deleted DIT students'
      using errcode = '23514';
  end if;
  if tg_op = 'INSERT' then
    insert into dit_exam_section_history(student_id, from_section_id, to_section_id, changed_by)
    values(new.student_id, null, new.exam_section_id, new.changed_by);
  elsif old.exam_section_id is distinct from new.exam_section_id then
    insert into dit_exam_section_history(student_id, from_section_id, to_section_id, changed_by)
    values(new.student_id, old.exam_section_id, new.exam_section_id, new.changed_by);
  end if;
  return new;
end;
$$;
create trigger dit_exam_section_move_history
after insert or update on dit_exam_section_memberships
for each row execute function record_dit_exam_section_move();

-- Historical results stay associated with their original exam section after a
-- move. Existing results remain NULL: do not invent historical membership.
alter table dit_mock_results add column exam_section_id uuid
  references dit_exam_sections(id) on delete restrict;
create index dit_mock_results_exam_section_idx on dit_mock_results(exam_section_id);

create function snapshot_dit_result_exam_section() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    select exam_section_id into new.exam_section_id
    from dit_exam_section_memberships where student_id = new.student_id;
  else
    new.exam_section_id := old.exam_section_id;
  end if;
  return new;
end;
$$;
create trigger dit_result_exam_section_snapshot
before insert or update on dit_mock_results
for each row execute function snapshot_dit_result_exam_section();
