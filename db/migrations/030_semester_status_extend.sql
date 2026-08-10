-- Extend semester_status enum with exam-period values
ALTER TYPE semester_status ADD VALUE IF NOT EXISTS 'mid_term';
ALTER TYPE semester_status ADD VALUE IF NOT EXISTS 'final_term';
