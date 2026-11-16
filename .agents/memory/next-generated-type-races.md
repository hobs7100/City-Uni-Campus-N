---
name: Next.js generated type races
description: Overlapping development generation and production type checking can produce false syntax failures in generated validators.
---

Avoid overlapping a development-server restart or hot reload with production type checking of Next.js-generated development types.

**Why:** The source type check passed, but a production build later failed on syntax errors in a generated development validator while the development server was rebuilding. This is not evidence that application source needs rewriting.

**How to apply:** Inspect the failing path first. If it is a generated development validator, isolate the production build from development generation and let Next.js regenerate its types; do not hand-edit generated files. Restart the preview workflow after the build finishes.
