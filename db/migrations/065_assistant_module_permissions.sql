-- Individual assistant overrides. No seeded overrides: current role defaults
-- continue to govern every existing and newly-created assistant.
create table if not exists assistant_module_permissions (
  user_id uuid not null references users(id) on delete cascade,
  module varchar(50) not null,
  can_view boolean not null default false,
  can_edit boolean not null default false,
  can_delete boolean not null default false,
  updated_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, module),
  check (can_view or (not can_edit and not can_delete)),
  check (not can_delete or can_edit)
);
