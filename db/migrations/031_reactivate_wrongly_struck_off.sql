-- Migration 031: Reactivate students who were incorrectly struck off.
--
-- A student should only be struck off when ALL of the following are true:
--   1. They have ≥ 10 coordinator attendance days (any record: present / absent / leave).
--   2. Their percentage (presents ÷ (presents + absents)) is < 60%.
--
-- Two classes of incorrect strike-offs are corrected here:
--   A) Students struck off with fewer than 10 coordinator attendance days on record
--      (the 10-day minimum was never satisfied — should never have been struck off).
--   B) Students struck off with ≥ 10 days but whose actual percentage is ≥ 60%
--      (caused by the earlier 50 % display-threshold bug or any other miscalculation).
--
-- Reactivated students receive a fresh reactivated_at timestamp so the
-- auto-struck-off protection window applies and they cannot be immediately
-- re-evaluated by the next attendance save.

-- ── Step 1: collect candidates ───────────────────────────────────────────────
-- For each struck-off student pick their most recent semester (active or closed)
-- to evaluate attendance against.
CREATE TEMP TABLE _wrongly_struck_off ON COMMIT DROP AS
WITH latest_semester AS (
  -- One row per student: the most recently created semester for their class,
  -- regardless of semester status (so recently-closed semesters are included).
  SELECT DISTINCT ON (st.id)
    st.id          AS student_id,
    sem.id         AS semester_id
  FROM   students st
  JOIN   semesters sem ON sem.class_id = st.class_id
  WHERE  st.status     = 'struck_off'
    AND  st.deleted_at IS NULL
  ORDER  BY st.id, sem.created_at DESC
),
attendance_counts AS (
  SELECT
    ls.student_id,
    ls.semester_id,

    -- Total days with ANY coordinator record (present / absent / leave).
    -- This is the denominator used for the ≥ 10 day eligibility check.
    COUNT(DISTINCT sar.attendance_date)
      AS total_days,

    -- Days where the student was marked present.
    COUNT(DISTINCT sar.attendance_date)
      FILTER (WHERE sar.status = 'present')
      AS present_days,

    -- Evaluable days (present OR absent — leave excluded) used for % calculation.
    COUNT(DISTINCT sar.attendance_date)
      FILTER (WHERE sar.status IN ('present', 'absent'))
      AS evaluable_days

  FROM   latest_semester ls
  LEFT JOIN student_attendance_records sar
         ON  sar.student_id  = ls.student_id
         AND sar.semester_id = ls.semester_id
  GROUP  BY ls.student_id, ls.semester_id
)
SELECT
  student_id,
  semester_id,
  total_days,
  present_days,
  evaluable_days,
  CASE
    WHEN evaluable_days > 0
    THEN ROUND((present_days::numeric / evaluable_days) * 100, 2)
    ELSE 0
  END AS attendance_pct
FROM   attendance_counts
WHERE
  -- Case A: not enough attendance data to justify a strike-off
  total_days < 10
  OR
  -- Case B: percentage is at or above the 60 % struck-off threshold
  (evaluable_days > 0 AND present_days::float / evaluable_days >= 0.60);

-- ── Step 2: reactivate ────────────────────────────────────────────────────────
UPDATE students
SET
  status                  = 'active',
  reactivated_at          = now(),
  status_changed_by_name  = 'System — Reactivated: incorrect strike-off corrected',
  status_change_date      = now()::date,
  updated_at              = now()
WHERE  id         IN (SELECT student_id FROM _wrongly_struck_off)
  AND  status     = 'struck_off'
  AND  deleted_at IS NULL;

-- ── Step 3: audit trail ───────────────────────────────────────────────────────
INSERT INTO student_status_history
  (student_id, previous_status, new_status, reason,
   triggered_by, semester_id, attendance_pct, attendance_days)
SELECT
  w.student_id,
  'struck_off',
  'active',
  CASE
    WHEN w.total_days < 10
    THEN 'Reactivated — insufficient coordinator attendance data ('
           || w.total_days || ' days recorded; minimum 10 required before evaluation)'
    ELSE 'Reactivated — attendance at or above 60% threshold ('
           || w.attendance_pct || '% with '
           || w.present_days || ' present / '
           || w.evaluable_days || ' evaluable days)'
  END,
  'SYSTEM',
  w.semester_id,
  w.attendance_pct,
  w.total_days
FROM _wrongly_struck_off w;
