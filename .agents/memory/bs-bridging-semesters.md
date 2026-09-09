---
name: BS-Bridging semester range
description: Classification and semester-number rules for Post-ADP Bridging classes.
---

BS-Bridging is a four-semester Post-ADP program whose semester numbers are 5, 6, 7, and 8—not 1 through 4. Any class name containing “Bridging” must be classified as BS-Bridging regardless of a conflicting submitted type.

**Why:** Bridging students enter after ADP and continue the BS sequence; treating total_semesters as the maximum semester number incorrectly creates Semesters 1–4.

**How to apply:** Use a range with start 5 and end 8 in creation, progression, validation, imports, and UI options. Preserve dependent record identities when repairing legacy numbering by adding four to existing Semester 1–4 values.