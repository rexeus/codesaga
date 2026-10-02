---
"codesaga": minor
---

The `analyze` JSON report gains the data for the story dashboard, all additive within `schemaVersion` 1. Each contributor carries `weekly` (commits per week over the last 52 weeks), `status` (`new`, `active` or `dormant`) and `badges`. The report carries `highlights` (notable facts, at most six) and `thresholds.areas` and `thresholds.badges`, the constants the new rules apply. The schema also reserves `knowledge.areas`, the non-overlapping areas at several depths with their badges, which later releases fill; `knowledge.directories` is deprecated in its favor and goes with `schemaVersion` 2. `highlights` and the badges are empty until those rules ship.
