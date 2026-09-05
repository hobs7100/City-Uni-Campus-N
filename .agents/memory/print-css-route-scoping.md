---
name: Print CSS route scoping
description: Prevent feature-specific print rules from breaking PDF output throughout the application.
---

Feature-specific print selectors and page settings must be scoped to the document that owns them; never use an unconditional global print rule that hides the entire DOM.

**Why:** A Campus Report visibility rule applied to every route and silently produced blank Billing and Timetable PDFs. An unscoped page-size rule also overrode other documents.

**How to apply:** Scope visibility rules by a unique print-root ancestor/presence selector, and use named CSS pages or isolated iframe documents when a feature needs a different page size.