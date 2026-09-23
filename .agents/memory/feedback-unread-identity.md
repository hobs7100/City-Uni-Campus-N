---
name: Feedback unread identity
description: Why admin feedback unread state needs message identity rather than a timestamp watermark.
---

Use exact per-message read receipts for student replies, separate from the original complaint's first-open state.

**Why:** PostgreSQL `now()` is the transaction start time. A reply inserted by a transaction that commits after an admin loads a conversation can have a timestamp earlier than the admin's last-seen timestamp; ties are possible too. A timestamp cutoff can silently mark a never-displayed reply as read.

**How to apply:** When a conversation is opened, record receipts only for message IDs actually returned to that reader. Count unread student replies by missing receipts, not by comparing timestamps.