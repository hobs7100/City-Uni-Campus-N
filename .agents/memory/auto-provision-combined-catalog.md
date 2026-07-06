---
name: Auto-provision vs. reject for combined-entity validation
description: When a strict "prerequisite record must already exist" check causes a legitimate user action to be rejected, consider auto-creating the missing record instead.
---

A validation rule that says "X must already exist before you can do Y" is sometimes over-strict when the action Y is itself evidence that X should exist. Example: allocating a teacher to teach a course as a combined lecture across multiple classes was rejected with "course not part of curriculum" whenever one of the combined classes' semesters didn't already have that course pre-added to its catalog — even though creating the combined allocation is exactly the action that establishes the course is taught there.

**Why:** The stricter reject-based validation matched the letter of an early spec ("a course must be in the semester's catalog to be allocated") but not its intent, and produced a false-positive error for a normal, expected workflow. Users had no natural way to "pre-add" the course to every combined semester first — the UI only ever shows courses from the primary semester's catalog.

**How to apply:** When a validation blocks an action because a related/joined entity hasn't been created yet, ask whether the action itself is sufficient justification to create that entity automatically (inside the same transaction) rather than reject. Keep the reject behavior only for the "primary"/directly-selected entity where the user explicitly chose from an existing list; auto-provision for secondary/implied entities (e.g. other semesters combined into the same lecture).
