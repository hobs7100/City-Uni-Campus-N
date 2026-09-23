---
name: Fine attendance source
description: Attendance fines and automatic standing decisions must use coordinator/admin class-wide attendance, never teacher course attendance.
---

Attendance fines and automatic strike-off evaluation are based only on `student_attendance_records` written by coordinator/admin workflows. Teacher course attendance is informational and must not create a fine, trigger a strike-off, or impose a struck-off reactivation minimum.

**Why:** Teacher marks represent individual course sessions, while the fine policy evaluates school-day attendance. Mixing the sources can create unjustified fines and status changes.

**How to apply:** Keep teacher attendance writes isolated to `student_course_attendance`; only coordinator/admin attendance saves may invoke automatic standing evaluation. Preserve a documented no-fine path for legacy teacher-origin strike-offs.