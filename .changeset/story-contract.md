---
"codesaga": minor
---

The `analyze` JSON report gains the data for the redesigned dashboard, all additive within `schemaVersion` 1. Each contributor carries `weekly` (commits per week over the last 52 weeks), `status` (`new`, `active` or `dormant`) and `badges`. The report carries `stories` (notable facts, at most six) and `thresholds.territories` and `thresholds.badges`, the constants the new rules apply. The schema also reserves `knowledge.territories`, the non-overlapping territories at several details with their badges, which later releases fill; `knowledge.directories` is deprecated in its favor and goes with `schemaVersion` 2. `stories` and the badges are empty until those rules ship.
