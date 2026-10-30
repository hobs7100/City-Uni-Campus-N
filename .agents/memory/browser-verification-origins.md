---
name: Browser verification through the preview origin
description: Authenticated Chromium checks can render SSR without hydration when localhost is not a permitted Next.js dev origin.
---

Use the proxied development origin for interactive Chromium checks when the app restricts Next.js development origins.

**Why:** Localhost loaded an authenticated server-rendered dashboard but never hydrated its controls. The same browser scenario passed through the proxied development origin without app changes. A visible page alone did not prove that interactions were ready.

**How to apply:** Distinguish SSR visibility from hydration before diagnosing a feature failure. Use the allowed preview origin, not a production URL or an auth bypass. If the testing callback rejects its configured agent kind, a standalone Chromium/CDP check is a viable fallback. Keep test sessions short-lived, out of logs and Git, and use isolated fixtures when live demo writes must not persist.
