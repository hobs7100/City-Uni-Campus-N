---
name: Teacher allocation identity
description: Diagnose teacher course visibility against the signed-in teacher record rather than display names.
---

Teacher allocations must be matched to the teacher account that actually signs in, not to a teacher with the same display name. When repairing a duplicate-account assignment, reassign the existing allocations only after checking login activity, ownership, and billing history; preserve the allocation IDs and attendance history.

**Why:** Two active records can have the same name but distinct sign-in identities. An allocation on the unused record is invisible to the account used for teaching, even though admin screens show the correct teacher name. Recreating allocations could orphan existing lecture records.

**How to apply:** Compare sign-in identity to allocation ownership when a teacher reports missing courses. Keep email visible alongside names in allocation and transfer selectors; do not automatically merge homonyms or rewrite marked attendance.