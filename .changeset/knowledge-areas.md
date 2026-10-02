---
"codesaga": minor
---

The knowledge section now reports areas: the repository cut into non-overlapping parts, so that every file belongs to exactly one area. Level 1 is the packages (found by their manifests, such as `package.json`, `Cargo.toml` or `go.mod`) or the top-level directories, each further level goes one directory step deeper, and an area that holds most of the files is split further so that no single area stands for the repository. `knowledge.areas` carries every level with the truck factor, islands and orphaned flags of each area, the level recommended for the team size and why (`reason`), and `totalAreas` per level before `--limit`. `analyze` takes `--depth <n>` (config key `depth`, MCP parameter `depth`) to start at another level, and its terminal view shows the riskiest areas of that level instead of directories. `knowledge.directories` stays but is deprecated. `thresholds.areas` states the new constants.
