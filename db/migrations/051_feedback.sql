create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  category varchar(40) not null check (category in ('Administration','Teaching Faculty','Non-Teaching Faculty','Coordinators','Hygiene Issue','Other')),
  other_issue varchar(200),
  body text not null,
  status varchar(20) not null default 'submitted' check (status in ('submitted','open','in_progress','resolved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((category = 'Other' and other_issue is not null and length(trim(other_issue)) > 0) or (category <> 'Other' and other_issue is null))
);
create index if not exists idx_feedback_student on feedback(student_id, created_at desc);
create index if not exists idx_feedback_status on feedback(status, created_at desc);

create table if not exists feedback_attachments (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references feedback(id) on delete cascade,
  url text not null,
  public_id text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_feedback_attachment_public on feedback_attachments(public_id);
create index if not exists idx_feedback_attachment_feedback on feedback_attachments(feedback_id);
create or replace function feedback_attachment_limit() returns trigger language plpgsql as $$
begin
  if (select count(*) from feedback_attachments where feedback_id = new.feedback_id) >= 2 then
    raise exception 'A feedback complaint may have at most two attachments';
  end if;
  return new;
end $$;
drop trigger if exists feedback_attachment_limit_trigger on feedback_attachments;
create trigger feedback_attachment_limit_trigger before insert on feedback_attachments
for each row execute function feedback_attachment_limit();

create table if not exists feedback_comments (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references feedback(id) on delete cascade,
  author_id uuid not null,
  author_role varchar(20) not null check (author_role in ('student','admin')),
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);
create index if not exists idx_feedback_comments_feedback on feedback_comments(feedback_id, created_at);

create table if not exists feedback_status_history (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references feedback(id) on delete cascade,
  status varchar(20) not null check (status in ('submitted','open','in_progress','resolved','rejected')),
  changed_by uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_feedback_history_feedback on feedback_status_history(feedback_id, created_at);
create or replace function prevent_feedback_history_mutation() returns trigger language plpgsql as $$
begin raise exception 'Feedback status history is immutable'; end $$;
drop trigger if exists feedback_history_immutable on feedback_status_history;
create trigger feedback_history_immutable before update or delete on feedback_status_history
for each row execute function prevent_feedback_history_mutation();