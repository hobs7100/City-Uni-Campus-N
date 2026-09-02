---
name: Shared allocation attendance scoping
description: Why course-attendance queries must constrain allocation-semester joins by the student's class.
---

Course allocations can be linked to semesters belonging to multiple classes. When presenting a student's course attendance by semester, require the joined semester's class to match the student's current class.

**Why:** Joining attendance to every semester associated with an allocation duplicates the same teacher-marked records under unrelated classes and semesters. Live data contains many such cross-class links.

**How to apply:** Start from semesters already scoped to the student's class, or add an explicit semester-class equality condition. Keep the attendance identity allocation + student + date + slot; do not infer course attendance from class-level daily records.