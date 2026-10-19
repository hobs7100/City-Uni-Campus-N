---
name: Transfer-chain schedule continuity
description: Non-obvious cause of missing student rosters after repeated teacher transfers.
---

When a reassigned course appears in a teacher's allocations but has no attendance roster, inspect timetable ownership across the full transfer chain, not only the immediate previous allocation.

**Why:** The BS IT Cyber Security incident had two transfers, yet the recurring timetable still referenced the original allocation. Both the intermediate and current allocations had no cells, even though the current teacher's semester links and curriculum were valid. Another course had the same legacy inconsistency.

**How to apply:** Separate recurring schedule ownership from historical lecture ownership. Repair only unambiguous same-chain, same-course, same-semester links to the current allocation; preserve previously marked attendance, billing, and closed-semester schedules. Do not weaken roster authorization or invent unscheduled slots to hide a broken schedule link.
