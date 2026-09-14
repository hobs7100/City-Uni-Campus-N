---
name: Portal permission capabilities
description: The safety and compatibility rules for centralized role/module view, edit, and delete access.
---

Portal permissions are the centralized capability source for managed staff roles. View controls navigation, server-rendered page access, and GET/HEAD APIs; Edit controls POST/PUT/PATCH; Delete controls DELETE. Admin always bypasses these controls. Missing managed-role rows fail closed.

**Why:** Navigation-only locks leave direct URLs and APIs exposed, while fail-open defaults make new modules silently accessible. Existing permission rows must be seeded visible before fail-closed behavior is enabled so current access is not lost.

**How to apply:** Add each admin module, dashboard route, and API prefix to the canonical registry. Give shared lookup APIs explicit read dependencies, keep mutations tied to the owning module, and include native role routes in the server-side resolver.