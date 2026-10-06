---
name: Rasterized examination slip PDFs
description: Why examination PDFs use browser rendering, and the CSS zoom trap in html2canvas.
---

Keep examination print and download documents based on the same HTML layout. Browser-side PDF generation avoids depending on a Chromium executable in the published server.

**Why:** The user requested PDF downloads of both slips with the existing printed layout, not just a print-dialog option. A browser-rendered PDF preserves that layout without introducing a deployment-specific server dependency.

**How to apply:** Preserve the shared document template when changing either slip; do not maintain a separate download template.

Do not rasterize an HTML element while CSS zoom is applied. Capture at its original size and scale the image into the PDF's printable area.

**Why:** Real browser verification showed html2canvas collapsing spaces and misplacing text under CSS zoom, even though native print-to-PDF remained correct. The problem was visible in longer slips that required single-page fitting.

**How to apply:** Test both the native print output and downloaded PDF with enough courses to require scaling; examine actual raster output, since successful PDF creation and page counts do not catch text-layout corruption.
