---
name: Print iframe viewport sizing
description: Why printable HTML must be laid out in a page-sized hidden iframe before single-page scaling is calculated.
---

Render hidden print documents in an iframe sized to the physical target page, then fit against both the printable width and height. Never use a 1px hidden iframe for content that is measured before printing.

**Why:** Screen layout occurs using the iframe viewport before the print dialog applies `@page`. A 1px viewport makes tables and grids wrap into an extremely tall document, producing an incorrect scale and a poor printed layout.

**How to apply:** Give the print iframe A4 dimensions, give the printable root an explicit millimetre width matching the page margins, wait for images and fonts, then calculate `min(1, availableWidth/contentWidth, availableHeight/contentHeight)`.