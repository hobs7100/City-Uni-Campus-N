---
name: Bulk regex file edits across many files
description: Risks of chaining generic cleanup regexes (e.g. whitespace collapse) onto a targeted find/replace sweep run via code_execution across a whole codebase
---

When doing a codebase-wide mechanical rewrite (e.g. swapping one CSS class pattern for another across dozens of files via a Node script in the code execution sandbox), a targeted regex replace (matching one specific literal pattern) is safe. But adding a second "cleanup" pass in the same script — e.g. `content.replace(/[ \t]{2,}(?=[a-zA-Z:])/g, ' ')` to collapse whitespace, or trimming spaces before quotes — is dangerous: it runs unconditionally on the entire file content, not just near the intended match, and will silently mangle unrelated code (e.g. `import x from "y"` becomes `from"y"`, indentation gets stripped).

**Why:** `tsc --noEmit` will often still pass on the mangled output (missing whitespace between an identifier and a string literal is syntactically valid JS/TS), so a clean typecheck is not sufficient evidence the bulk edit was safe.

**How to apply:** After any multi-file scripted regex edit, run `git diff --stat` and spot-check a `git diff` on a handful of files (including ones you didn't expect to need semantic changes) before trusting the result — a wall of unrelated 1-line-changed-per-line diffs is the signature of an over-broad regex. If damage is found but confined to whitespace/formatting (verify via tsc/build still passing), installing and running `prettier --write` across the affected globs is a fast, safe way to restore correct formatting without hand-fixing every file.
