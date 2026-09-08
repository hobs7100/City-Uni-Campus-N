---
name: Reactivation fine integrity
description: Transaction and access rules for reactivating struck-off students when a fine is required.
---

A struck-off student may be reactivated only through the individual fine workflow. Lock the student row, re-check struck-off status, save the selected protection start date, write status history, and insert the fine ledger record in one transaction.

**Why:** Separate writes or bulk activation can produce active students with no fine record, while concurrent requests can create duplicate fines and history. The selected date must be the source of truth for the fresh attendance protection window.

**How to apply:** Any future reactivation path must require the financial reference and effective date, use row locking plus a conditional status update, preserve exact-role restrictions, and either commit every related record or roll back all of them.