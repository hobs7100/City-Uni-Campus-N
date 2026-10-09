---
name: GitHub commit upload fallback
description: Separate Git credentials from the GitHub integration, and safely upload verified commits through the Git Data API.
---

Do not assume the GitHub integration needs reauthorization because a shell `git push` fails authentication. Check repository access through the existing integration before asking the user to reconnect.

**Why:** The workspace's saved Git credentials rejected a push while the connected GitHub App could still access the same repository. These authentication paths are independent.

**How to apply:** If shell pushing fails but the integration works, use GitHub's Git Data API to upload the local commit's changed blobs/tree and original author, committer, parents, message, and dates. First prove the remote head is an ancestor of local HEAD. Verify the uploaded tree and commit SHA match locally before fast-forwarding the branch with `force: false`. Never expose credentials or overwrite divergent remote work.

Preserve the commit message verbatim, including its final newline; do not trim it before sending it to the Git Data API.

**Why:** GitHub hashes the supplied message exactly. Removing the final newline produces a different commit SHA even when the tree, parents and identities match.

**How to apply:** Extract everything after the first blank line in the raw local commit without `trim()` or `trimEnd()`, and compare the returned SHA before updating the branch.
