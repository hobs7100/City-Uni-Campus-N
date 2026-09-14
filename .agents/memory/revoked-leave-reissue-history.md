---
name: Revoked leave reissue history
description: Rules for preserving student leave cycles when an administrator revokes and later reissues leave.
---

A revoked student leave remains a historical record. If leave is granted again later, create a new leave record with its own issue date instead of reopening or overwriting the revoked row. Preserve the prior revocation timestamp and allow only one active open-ended leave per student.

**Why:** Administrators may revoke and reissue leave multiple times, and each cycle's issue and revocation dates must remain auditable.

**How to apply:** Serialize revoke and issue operations by locking the student first. Treat only non-revoked rows as active conflicts, and display each historical row's issue and revocation dates.