---
name: Print iframe viewport sizing
description: Why printable HTML must be laid out in a page-sized hidden iframe before single-page scaling is calculated.
---

Render hidden print documents in an iframe sized to the physical target page, then fit against both the printable width and height. Never use a 1px hidden iframe for content that is measured before printing. For strict edge safety, use an explicit body padding in millimetres rather than relying only on `@page` margins.

**Why:** Screen layout occurs using the iframe viewport before the print dialog applies `@page`. A 1px viewport makes tables and grids wrap into an extremely tall document, while browser/printer combinations may apply `@page` margins inconsistently.

**How to apply:** Give the print iframe A4 dimensions, use `@page` margin zero plus explicit body padding for the safe area, size the root to the remaining millimetres, wait for assets, then fit against both axes.