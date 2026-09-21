---
name: Reactivation fine integrity
description: Transaction and access rules for reactivating struck-off students when a fine is required.
---

A struck-off student may be reactivated only through the individual fine workflow. Lock the student row, re-check struck-off status, save the selected protection start date, write status history, and insert the fine ledger record in one transaction.

**Why:** Separate writes or bulk activation can produce active students with no fine record, while concurrent requests can create duplicate fines and history. The selected date must be the source of truth for the fresh attendance protection window.

Attendance-fine discounts and waivers are append-only audit events scoped to a durable assessment-cycle ID. Paid reactivation rotates that ID atomically; later strike-off must not reuse an earlier cycle's adjustment.

**Why:** A mutable adjustment row loses financial audit history, while scoping by a timestamp that strike-off clears can resurrect an old waiver or discount in a later cycle.

**How to apply:** Any future reactivation path must require the financial reference and effective date, use row locking plus a conditional status update, rotate the fine cycle in the same transaction, preserve exact-role restrictions, and either commit every related record or roll back all of them. Adjustment writes must lock and verify the expected cycle before appending.