// Owns the overview section: commits, contributor counts, and the size and languages of the universe.
// It reads the universe as inventory already measured it and never touches files.
// Languages come from the allow-list's extension map; one pass over the universe.

import type { DateTime } from "effect";

import type { ClassifiedCommit } from "../automation/classify.js";
import type { Report } from "../report/report.js";
import type { InventoryFile } from "../universe/inventory.js";
import { languageOf } from "../universe/languages.js";

// @scaffold links the language map into the module graph; the body calls it once implemented.
void languageOf;

type OverviewInput = {
  /** The window's commits of every class. */
  readonly commits: ReadonlyArray<ClassifiedCommit>;
  readonly universe: ReadonlyArray<InventoryFile>;
  /** The `Clock` time that the 30, 90 and 365 day counts are measured back from. */
  readonly now: DateTime.Utc;
};

/**
 * The `overview` section: the window's commit count, contributors in total
 * and active in the last 30, 90 and 365 days, and the universe's files and
 * non-blank lines, per language with the most lines first.
 */
export const overview = (_input: OverviewInput): Report["overview"] => {
  throw new Error("@scaffold not implemented");
};
