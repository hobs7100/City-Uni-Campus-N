-- Phase 11: Student status audit trail + reactivation protection window
-- student_status_history records every automated status change so nothing
-- is ever silently lost.  reactivated_at enables the 10-attendance-day
-- protection period after a STRUCK_OFF → ACTIVE reinstatement.

create table if not exists student_status_history (
  id              uuid        primary key default gen_random_uuid(),
  student_id      uuid        not null references students(id) on delete cascade,
  previous_status text        not null,
  new_status      text        not null,
  changed_at      timestamptz not null default now(),
  reason          text,
  -- who triggered the change: COORDINATOR | TEACHER | ADMIN | HOD | SYSTEM
  triggered_by    text        not null,
  semester_id     uuid        references semesters(id) on delete set null,
  -- attendance percentage at the time of the change (0-100)
  attendance_pct  numeric(5,2),
  -- number of attendance days counted in the evaluation window
  attendance_days int
);

create index if not exists idx_ssh_student    on student_status_history(student_id);
create index if not exists idx_ssh_changed_at on student_status_history(changed_at desc);
create index if not exists idx_ssh_sem        on student_status_history(semester_id);

-- Reactivation timestamp: set when status STRUCK_OFF → ACTIVE.
-- runAutoStruckOff counts only attendance days *after* this timestamp
-- so the student gets a fresh 10-day protection window.
alter table students add column if not exists reactivated_at timestamptz;
-- Also make sure roll_no is available for notices (add if missing)
alter table students add column if not exists roll_no text;
