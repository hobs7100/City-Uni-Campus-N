---
name: Teacher attendance billing lock
description: Atomic persistence and verification rules for Coordinator-marked teacher attendance.
---

Teacher attendance inserts and edits must enforce the billed-record lock inside the upsert itself, and a successful API response must require the database to return the persisted row. The Coordinator UI should verify that returned identity through an uncached roster refresh before displaying success.

**Why:** A separate billed-record pre-check and upsert leaves a race window, while an unverified frontend success message cannot distinguish persistence from stale readback or malformed responses.

**How to apply:** Use a conflict update guarded by the existing row's unbilled state, treat an empty `RETURNING` result as a locked record, and match the refreshed lecture by allocation plus start and end times.