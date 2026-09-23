-- Track each admin's last viewed message in a complaint.
-- The initial complaint counts as unread until the first open.
create table if not exists feedback_admin_reads (
  feedback_id uuid not null references feedback(id) on delete cascade,
  admin_id uuid not null references users(id) on delete cascade,
  read_at timestamptz not null,
  primary key (feedback_id, admin_id)
);

create index if not exists idx_feedback_admin_reads_admin on feedback_admin_reads(admin_id);