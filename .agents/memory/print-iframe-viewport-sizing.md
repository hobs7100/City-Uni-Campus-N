---
name: Print iframe viewport sizing
description: Why printable HTML must be laid out in a page-sized hidden iframe before single-page scaling is calculated.
---

Render hidden print documents in an iframe sized to the physical target page, then fit against both the printable width and height. Never use a 1px hidden iframe for content that is measured before printing. When applying CSS `zoom` to a single-page root, fix its unscaled width and allow some height slack; otherwise zoom may reflow an auto-width root and push the last section to page two. Wait for the iframe document and its assets to load, then schedule `print()` from the iframe window's event loop. For strict edge safety, use explicit body padding in millimetres rather than relying only on `@page` margins.

For a batch of separate one-page reports, measure and fit **each** report root, then force a page break between roots. Give subsequent roots their own top inset: body padding may position the first page correctly but does not reliably repeat at the top of later printed pages.

**Why:** Screen layout occurs using the iframe viewport before the print dialog applies `@page`. A 1px viewport makes tables and grids wrap into an extremely tall document, while printing before iframe readiness can cause Chromium to print the active dashboard instead of the generated document. With an auto-width root, a zoom value computed from the initial height can alter the root's layout and increase its height enough to put signatures on a second page. A multi-student landscape PDF showed that fitting only the first report leaves later reports unscaled, and body padding alone leaves a later page's header too close to its top edge.

**How to apply:** Give the print iframe dimensions matching the page orientation, use `@page` margin zero plus explicit body padding for the safe area, size every report root to a fixed printable width, await frame/assets, fit each root against both axes with a little vertical headroom, and defer the frame window's print call. On batch pages after the first, add a root-level top inset.