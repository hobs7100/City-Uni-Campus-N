---
name: Billing claims and paid-record immutability
description: Durable integrity rules that prevent concurrent, overlapping, or lifecycle-based duplicate faculty payments.
---

Bill generation must serialize per teacher, lock the candidate unbilled attendance, and claim the exact locked row IDs with a verified row count in the same transaction. Preview filtering alone is never a payment-integrity control.

Once a bill is paid, the bill, its line items, and the attendance-to-line-item claims must all be immutable. Protecting only the parent bill is insufficient because deleting a child item can release paid attendance through an `ON DELETE SET NULL` foreign key.

Visiting fixed-rate allocations represent one flat entitlement per calendar month. Every fixed visiting line item needs a normalized month key, with a database uniqueness rule covering allocation plus month. Preview and every generator must apply the same eligibility rule.

A visiting bill may span multiple calendar months while remaining one parent bill. Variable-rate attendance aggregates across the selected range; fixed-rate attendance becomes one line item per allocation and attendance month. Semester and custom generators must use this same attendance-month key rather than the bill-generation month.

**Why:** Concurrent generators can both observe unclaimed attendance, and child deletion or claim reassignment can make already-paid attendance billable again. Fixed-rate date slices can also produce multiple flat charges without reusing an attendance row.

**How to apply:** Any new billing route must use the shared teacher lock discipline, exact claim verification, monthly fixed entitlement where applicable, and database guards across bills, bill items, and attendance claims. Unpaid bill deletion may release claims; paid records may not.

PostgreSQL `BEFORE` row triggers that guard attendance must return `NEW` for allowed `INSERT`/`UPDATE` operations and `OLD` for allowed `DELETE` operations. Returning `OLD` from `BEFORE INSERT` resolves to null and silently cancels an otherwise valid unbilled attendance insert.

**Why:** A paid-claim guard once used a shared final `RETURN OLD`; new teacher attendance appeared to conflict with billing because PostgreSQL cancelled the insert and the upsert returned no row.

**How to apply:** Keep paid-parent checks separate from pass-through return semantics, and regression-test new unbilled inserts, unbilled updates, paid updates, and unpaid deletion whenever these triggers change.

Only teacher attendance with status `ok` represents delivered, billable lectures. Every non-present status must carry zero lecture count; enforce this in the form, API canonicalization, and a database check.

**Why:** Allowing absent, fixture, or exam statuses to retain the form's default count inflated unbilled faculty totals.

**How to apply:** Hide lecture-count controls for non-present statuses, force zero server-side, and normalize only unbilled historical records so paid billing history remains immutable.