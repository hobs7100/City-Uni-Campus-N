---
name: DIT Mid-Term publication
description: Administrative release requirement for DIT Mid-Term test-series results.
---

DIT results for the test series named “Mid-Term” must remain hidden from students until an admin shows them. The admin control is reversible: it must support both Show and Hide. Teachers still enter and review their relevant course results normally.

**Why:** The user requires administrative control of DIT Mid-Term visibility and explicitly requested both Show and Hide; uploading marks is not publication.

**How to apply:** Enforce visibility server-side, including student dashboard/chart data and filter options, not only in the results table. Do not change other test-series visibility or non-DIT examination flows. Send explicit desired states rather than a server-side inversion, so retries remain safe. Hiding clears the current publication state without deleting marks; showing again starts a new publication cycle. Repeated Show requests preserve the current cycle's announcing admin and time.
