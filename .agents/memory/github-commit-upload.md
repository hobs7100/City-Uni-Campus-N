---
name: GitHub commit upload fallback
description: Separate Git credentials from the GitHub integration, and safely upload verified commits through the Git Data API.
---

Do not assume the GitHub integration needs reauthorization because a shell `git push` fails authentication. Check repository access through the existing integration before asking the user to reconnect.

**Why:** The workspace's saved Git credentials rejected a push while the connected GitHub App could still access the same repository. These authentication paths are independent.

**How to apply:** If shell pushing fails but the integration works, use GitHub's Git Data API to upload the local commit's changed blobs/tree and original author, committer, parents, message, and dates. First prove the remote head is an ancestor of local HEAD. Verify the uploaded tree and commit SHA match locally before fast-forwarding the branch with `force: false`. Never expose credentials or overwrite divergent remote work.
