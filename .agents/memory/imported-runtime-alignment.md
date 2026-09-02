---
name: Imported runtime alignment
description: Runtime compatibility checks for projects imported into Replit
---

The Replit module declared by an imported project should match the version range in its package manager metadata before dependency installation and workflow verification.

**Why:** Imported projects may include a generated `.replit` module list that defaults to an older Node version than the project's declared engine, allowing a preview to start while leaving fresh setups unsupported.

**How to apply:** Compare `.replit` modules with `engines` and `packageManager`, select an available compatible runtime, then reinstall from the lockfile and restart the workflow.