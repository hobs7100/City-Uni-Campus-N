---
name: Upload limit contracts
description: Keep upload limits aligned across UI validation, API enforcement, and file category requirements.
---

Upload limits are category-specific contracts. Profile photos may need a larger allowance than documents; do not reuse one global limit when the UI advertises different limits.

**Why:** The student profile screen advertised 5 MB while shared client and server guards rejected files above 500 KB, making ordinary photos appear broken even when storage was configured.

**How to apply:** Define named limits per upload category and consume the same category constants in both client validation and API enforcement. Verify storage credentials separately from size validation.