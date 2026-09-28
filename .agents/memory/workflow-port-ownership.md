---
name: Workflow port ownership
description: Distinguish a managed workflow from an orphaned shell server before restarting a web app.
---

An app answering on the expected port does not prove that its configured workflow owns that process. When a workflow reports address-in-use while the app is reachable, identify which process owns the port and whether it belongs to the workflow or a leftover shell execution.

**Why:** A shell-started development server remained alive after a workflow restart. The duplicate workflow failed to bind even though the login page still answered, misleading simple availability checks.

**How to apply:** Compare the process tree and workflow logs before another restart. Clear only a confirmed orphan, then restart the existing workflow once and verify both workflow health and HTTP response. Avoid creating a second workflow.