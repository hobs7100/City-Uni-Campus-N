---
name: Reactivation fine integrity
description: Transaction and access rules for reactivating struck-off students when a fine is required.
---

A struck-off student may be reactivated only through the individual fine workflow. Lock the student row, re-check struck-off status, save the selected protection start date, write status history, and insert the fine ledger record in one transaction.

**Why:** Separate writes or bulk activation can produce active students with no fine record, while concurrent requests can create duplicate fines and history. The selected date must be the source of truth for the fresh attendance protection window.

Attendance-fine discounts and waivers are append-only audit events scoped to a durable assessment-cycle ID. Paid reactivation rotates that ID atomically; later strike-off must not reuse an earlier cycle's adjustment.

**Why:** A mutable adjustment row loses financial audit history, while scoping by a timestamp that strike-off clears can resurrect an old waiver or discount in a later cycle.

**How to apply:** Any future reactivation path must require the financial reference and effective date, use row locking plus a conditional status update, rotate the fine cycle in the same transaction, preserve exact-role restrictions, and either commit every related record or roll back all of them. Adjustment writes must lock and verify the expected cycle before appending.

Payment confirmation must bind to the exact fine quote shown to the operator, not only the cycle ID.

**Why:** Attendance or an adjustment can change gross/net amounts without rotating the cycle; silently charging the refreshed amount can make the collected payment disagree with the ledger.

**How to apply:** Submit the displayed attendance counts, gross, discount/waiver version, and net amount. After locking the student, recompute on the same transaction connection and return a stale-quote conflict if any value differs.

A struck-off student's fine must remain retrievable after the relevant semester is closed. Prefer an active/mid-term semester when one exists; otherwise use the semester recorded on the latest strike-off history, then legacy status-change metadata, then attendance-backed history.

**Why:** Students can remain struck off after semester closure. Restricting assessments to active/mid-term semesters makes their mandatory reactivation fine disappear.

**How to apply:** Keep fine display and transactional revalidation on the same ordered semester-selection rule. Record `semester_id` on every manual status-history entry so new strike-off cycles do not depend on inference.