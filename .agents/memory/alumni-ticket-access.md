---
name: Alumni ticket access
description: Alumni keep support access but lose student academic access; ticket attachments require private delivery.
---

Alumni remain able to sign in, view their overview, and use Tickets/Inquiry, but academic and exam APIs should reject Alumni even if an old direct link or browser session remains. Ticket documents belong to the ticket's current participants and should not be delivered with public storage URLs.

**Why:** Hiding dashboard tabs alone does not prevent direct API requests, and redirecting to a public attachment URL lets anyone with the copied URL bypass ticket authorization.

**How to apply:** Keep support/profile routes available to Alumni while centrally guarding academic routes. Verify student ownership or current employee assignment on every ticket, history, and attachment request; stream private storage assets through an authorized endpoint.