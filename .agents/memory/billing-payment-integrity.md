---
name: Billing claims and paid-record immutability
description: Durable integrity rules that prevent concurrent, overlapping, or lifecycle-based duplicate faculty payments.
---

Bill generation must serialize per teacher, lock the candidate unbilled attendance, and claim the exact locked row IDs with a verified row count in the same transaction. Preview filtering alone is never a payment-integrity control.

Once a bill is paid, the bill, its line items, and the attendance-to-line-item claims must all be immutable. Protecting only the parent bill is insufficient because deleting a child item can release paid attendance through an `ON DELETE SET NULL` foreign key.

Visiting fixed-rate allocations represent one flat entitlement per calendar month. Every fixed visiting line item needs a normalized month key, with a database uniqueness rule covering allocation plus month. Preview and every generator must apply the same eligibility rule.

**Why:** Concurrent generators can both observe unclaimed attendance, and child deletion or claim reassignment can make already-paid attendance billable again. Fixed-rate date slices can also produce multiple flat charges without reusing an attendance row.

**How to apply:** Any new billing route must use the shared teacher lock discipline, exact claim verification, monthly fixed entitlement where applicable, and database guards across bills, bill items, and attendance claims. Unpaid bill deletion may release claims; paid records may not.