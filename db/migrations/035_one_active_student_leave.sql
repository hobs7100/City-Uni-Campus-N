drop index if exists idx_student_leaves_active_type;

create unique index if not exists uq_student_leaves_one_active
  on student_leaves(student_id)
  where revoked_at is null;