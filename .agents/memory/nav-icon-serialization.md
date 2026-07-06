---
name: Next.js Server-to-Client icon props
description: Passing Lucide/component values as props across the Server->Client Component boundary throws "Functions cannot be passed directly to Client Components"
---

Passing a component reference (e.g. a `LucideIcon`, or any object with a `render`/`$$typeof` function) as a prop from an `async` Server Component into a `"use client"` component fails at runtime with:

> Only plain objects can be passed to Client Components from Server Components. Classes or other objects with methods are not supported.
> Functions cannot be passed directly to Client Components...

This is easy to hit in nav/menu configs (e.g. a shared `NavItem { icon: LucideIcon }` type used by both a server layout and a client sidebar) or in dashboard "stat card" data built in a server page and handed to a client `<StatCard icon={SomeIcon} />`.

**Why:** Server Components serialize their props to send across the RSC boundary; component functions aren't serializable, only plain data is.

**How to apply:** Keep the config as a string key (e.g. `icon: "GraduationCap"`) in the shared/server-visible type, and do the string -> component lookup with a local `Record<string, LucideIcon>` map defined inside the client component itself. Never store or forward the actual component reference outside of a client file. Any icon rendered directly inside a Server Component's own JSX (not forwarded as a prop) is fine — the boundary only matters when crossing into a client component's props.
