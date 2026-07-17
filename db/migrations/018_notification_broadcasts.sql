-- Campus Management System - Phase 10 Schema
-- Notification Broadcasts: tracks admin-posted notifications for the All Notifications view

create table if not exists notification_broadcasts (
  id uuid primary key default gen_random_uuid(),
  department_id uuid references departments(id) on delete set null,
  class_id uuid references classes(id) on delete set null,
  session varchar(20),
  notification_date date not null,
  subject varchar(200) not null,
  body text not null,
  recipient_count int not null default 0,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_notification_broadcasts_dept on notification_broadcasts(department_id, created_at desc);
create index if not exists idx_notification_broadcasts_class on notification_broadcasts(class_id);
