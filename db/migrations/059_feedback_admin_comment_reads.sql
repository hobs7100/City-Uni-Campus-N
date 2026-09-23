-- Exact per-admin read receipts avoid timestamp ties and concurrent-insert races.
create table if not exists feedback_admin_comment_reads (
  admin_id uuid not null references users(id) on delete cascade,
  comment_id uuid not null references feedback_comments(id) on delete cascade,
  primary key (admin_id, comment_id)
);