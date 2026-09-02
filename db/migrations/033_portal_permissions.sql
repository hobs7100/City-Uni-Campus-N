create table if not exists portal_permissions (
  role user_role not null,
  module varchar(50) not null,
  can_edit boolean not null default true,
  can_delete boolean not null default true,
  updated_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (role, module)
);

create index if not exists idx_portal_permissions_role
  on portal_permissions(role);