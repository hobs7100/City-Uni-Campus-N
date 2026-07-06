-- Campus Management System - Phase 9 Schema
-- Notifications (supports Teacher/HoD/Student Dashboards, modules 16-18)

create type notification_recipient_type as enum ('user', 'teacher', 'student');

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_type notification_recipient_type not null,
  recipient_id uuid not null,
  title varchar(200) not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_recipient on notifications(recipient_type, recipient_id, created_at desc);
create index if not exists idx_notifications_unread on notifications(recipient_type, recipient_id) where is_read = false;
