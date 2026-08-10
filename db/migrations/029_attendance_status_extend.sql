-- Extend attendance_status enum with three new values
ALTER TYPE attendance_status ADD VALUE IF NOT EXISTS 'mid_term';
ALTER TYPE attendance_status ADD VALUE IF NOT EXISTS 'all_absent';
ALTER TYPE attendance_status ADD VALUE IF NOT EXISTS 'final_term';
