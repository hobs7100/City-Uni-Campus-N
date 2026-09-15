---
name: Print iframe viewport sizing
description: Why printable HTML must be laid out in a page-sized hidden iframe before single-page scaling is calculated.
---

Render hidden print documents in an iframe sized to the physical target page, then fit against both the printable width and height. Never use a 1px hidden iframe for content that is measured before printing. Wait for the iframe document and its assets to load, then schedule `print()` from the iframe window's event loop. For strict edge safety, use explicit body padding in millimetres rather than relying only on `@page` margins.

**Why:** Screen layout occurs using the iframe viewport before the print dialog applies `@page`. A 1px viewport makes tables and grids wrap into an extremely tall document, while printing before iframe readiness can cause Chromium to print the active dashboard instead of the generated document.

**How to apply:** Give the print iframe A4 dimensions, use `@page` margin zero plus explicit body padding for the safe area, size the root to the remaining millimetres, await frame/assets, fit against both axes, and defer the frame window's print call.