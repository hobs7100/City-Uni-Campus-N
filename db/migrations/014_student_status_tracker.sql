-- Track who last changed a student's status
ALTER TABLE students ADD COLUMN IF NOT EXISTS status_changed_by_name VARCHAR(150);
