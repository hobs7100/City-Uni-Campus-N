-- Student inquiries and auditable staff ticket workflow.
create table if not exists ticket_categories (
  id uuid primary key default gen_random_uuid(),
  title varchar(120) not null check (length(trim(title)) > 0),
  active boolean not null default true,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists idx_ticket_categories_active_title
  on ticket_categories (lower(title)) where active;

create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete restrict,
  category_id uuid not null references ticket_categories(id) on delete restrict,
  description text not null check (length(trim(description)) > 0),
  status varchar(20) not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed')),
  assigned_user_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tickets_student on tickets(student_id, created_at desc);
create index if not exists idx_tickets_assignment on tickets(assigned_user_id, status, updated_at desc);
create index if not exists idx_tickets_status on tickets(status, updated_at desc);

create table if not exists ticket_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets(id) on delete cascade,
  event_type varchar(30) not null check (event_type in (
    'created', 'assigned', 'status', 'remark', 'document_requested', 'document_uploaded'
  )),
  actor_type varchar(20) not null check (actor_type in ('student', 'admin', 'employee')),
  actor_id uuid not null,
  actor_role varchar(30) not null,
  status_snapshot varchar(20) not null check (status_snapshot in ('pending', 'in_progress', 'completed')),
  remark text,
  created_at timestamptz not null default now()
);
create index if not exists idx_ticket_events_ticket on ticket_events(ticket_id, created_at, id);

create table if not exists ticket_document_requests (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets(id) on delete cascade,
  requested_event_id uuid not null unique references ticket_events(id) on delete restrict,
  fulfilled_event_id uuid unique references ticket_events(id) on delete set null,
  fulfilled_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_ticket_document_requests_open
  on ticket_document_requests(ticket_id, created_at) where fulfilled_event_id is null;

create table if not exists ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets(id) on delete cascade,
  event_id uuid not null references ticket_events(id) on delete cascade,
  request_id uuid references ticket_document_requests(id) on delete set null,
  name varchar(255) not null,
  mime_type varchar(100) not null check (mime_type in ('application/pdf', 'image/jpeg', 'audio/mpeg', 'video/mpeg')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 2097152),
  resource_type varchar(10) not null check (resource_type in ('image', 'raw', 'video')),
  asset_version integer not null check (asset_version > 0),
  public_id text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists idx_ticket_attachments_event on ticket_attachments(event_id);

create or replace function prevent_ticket_event_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'Ticket history is immutable';
end;
$$;
drop trigger if exists ticket_events_immutable on ticket_events;
create trigger ticket_events_immutable
before update or delete on ticket_events
for each row execute function prevent_ticket_event_mutation();

create or replace function ticket_attachment_event_limit() returns trigger
language plpgsql as $$
begin
  if (select count(*) from ticket_attachments where event_id = new.event_id) >= 2 then
    raise exception 'A ticket event may have at most two attachments';
  end if;
  return new;
end;
$$;
drop trigger if exists ticket_attachment_event_limit_trigger on ticket_attachments;
create trigger ticket_attachment_event_limit_trigger
before insert on ticket_attachments
for each row execute function ticket_attachment_event_limit();