---
name: SSR client component + Date() hydration mismatches
description: Why "use client" components that compute new Date()/toLocaleString() on first render can hydrate-mismatch, and the fix pattern.
---

Next.js "use client" components are still rendered on the server for the initial HTML (SSR), then hydrated on the client. If such a component computes something time/locale-dependent during its normal render path — `new Date()`, `.toLocaleString()`/`.toLocaleDateString()` on a value, "is this the current day" comparisons — the server's clock/timezone/locale can differ from the browser's, producing different output in the two passes. React then throws a hydration mismatch error and regenerates the subtree client-side (visible flash / console errors), even though the app is otherwise working fine.

**Why:** The server process's system timezone/locale is not guaranteed to match the visiting browser's. Even when they nominally match, a render can straddle a time boundary between the SSR pass and hydration.

**How to apply:**
- For formatting an already-known timestamp (e.g. a DB column) for display: use a deterministic, timezone-fixed formatter (e.g. explicit UTC formatting) instead of `toLocaleString()`, OR only format it after mount.
- For "current date/time"-dependent UI (e.g. a calendar highlighting "today"): don't compute `new Date()` in the initial render path at all. Initialize the relevant state as `null`/loading, then set the real value inside a `useEffect` (runs client-only, post-hydration) so the first client render after mount naturally diverges from SSR output without React flagging it as a mismatch. Render a neutral loading/placeholder state for the SSR pass.
- This only matters for components whose *initial* render is server-rendered (e.g. rendered directly inside a Server Component page/layout with props, so Next.js SSRs them). Purely client-fetched components (data loaded via `useEffect` after mount, showing a loading state during SSR) are not at risk since there's nothing time-dependent in their SSR output.
