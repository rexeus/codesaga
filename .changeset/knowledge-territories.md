---
"codesaga": minor
---

The knowledge section now reports territories: the repository cut into non-overlapping slices, so that every file belongs to exactly one territory. A territory is a `package`, a `folder`, or the small leftovers grouped as `other` files; the entry on adaptive territories says how they are cut. `knowledge.territories` carries the truck factor, islands and orphaned flags of each territory, the `recommendedDetail` for the team size and why (`reason`). `analyze` takes `--detail <n>` (config key `detail`, MCP parameter `detail`) to start at another detail; `depth` still works as a deprecated alias in all three. Its terminal view shows the riskiest territories instead of directories. `knowledge.directories` stays but is deprecated. `thresholds.territories` states the new constants.
