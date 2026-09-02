---
name: Portal permission overlay
description: The safety and compatibility rules for role/module edit and delete controls.
---

Portal permissions are a restrictive overlay on the existing route-role authorization. They may lock an action a role previously had, but enabling a switch must not grant access to a route that role could not already use. Admin always bypasses these locks. An absent permission row means allowed so deployments preserve existing behavior until an administrator deliberately changes a setting.

**Why:** Replacing route authorization with a configurable matrix could accidentally expand privileges, while default-deny on migration would unexpectedly stop existing campus operations.

**How to apply:** New managed modules should keep their current role checks, add the Portal Management check after authentication, map non-destructive mutations to Edit and destructive mutations to Delete, and retain the Admin bypass and allow-on-missing default.