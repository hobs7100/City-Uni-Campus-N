---
name: Password onboarding scope
description: Preserve custom portal authorization and treat all-account password resets as explicitly authorized one-time operations.
---

Default-password sign-in must lead to mandatory personal-password setup before portal access. Administrative resets repeat that requirement; password emails are no longer part of account provisioning or reset. Preserve the existing roles, permissions, enrollment restrictions and other application behavior.

**Why:** The user explicitly requested this password lifecycle while repeatedly emphasizing that existing functionality must remain unchanged.

**How to apply:** Extend the existing custom authentication rather than substituting an identity provider. Enforce the setup restriction on the server, including direct APIs, and do not broaden an administrator or assistant's existing account-management permissions.

The all-account default-password reset was authorized as a one-time operation, not a recurring deployment or startup behavior.

**Why:** The user specified “For Now” for resetting everyone. Repeating a bulk reset would erase passwords people have subsequently chosen.

**How to apply:** Apply schema migrations separately from credential resets. Never put the bulk reset in startup, publishing or post-merge hooks; run it only on a new explicit request. Do not store password values in agent memory.
