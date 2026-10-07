---
name: Fresh HTTP response bodies
description: Why API authorization failures must create a new Response on every request.
---

Cache response data if necessary, never a constructed HTTP Response object reused across requests.

**Why:** Web-standard response bodies are consumable streams. Reusing the same authorization response made the second blocked slip request lose its JSON error body, even though the first request returned the right reason.

**How to apply:** Shared authorization guards should create a fresh JSON response for every rejection. Test repeated blocked requests, not only the first one.
