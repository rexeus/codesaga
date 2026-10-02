// Tests only: a universe file measured from real text, as the inventory measures files it reads.
import { commentSyntaxOf } from "../stats/comments.js";
import { measureText } from "../stats/measure-text.js";
import { universeStats } from "../stats/universe-stats.js";
import type { InventoryFile } from "../universe/inventory.js";
import { languageOf } from "../universe/languages.js";

/** `count` non-blank lines of text. */
export const linesOf = (count: number): string => "x\n".repeat(count);

/** The universe file at `path` holding `text`, measured like the inventory does; 50 plain lines by default. */
export const inventoryFile = (
  path: string,
  text: string = linesOf(50),
): InventoryFile => ({
  path,
  ...measureText(text, commentSyntaxOf(languageOf(path))),
});

/** The stats of `universe` over `commits`, as the whole history and the window alike, counting every path as code. */
export const universeStatsOf = (
  universe: ReadonlyArray<InventoryFile>,
  commits: Parameters<typeof universeStats>[0]["window"],
) =>
  universeStats({
    universe,
    history: commits,
    window: commits,
    isCodePath: () => true,
  });
