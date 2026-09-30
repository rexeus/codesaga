// Owns the contributors section: one entry per human or agent-assisted identity.
// Bots and agents are not contributors; automation reports them.
// Returns every contributor; truncating for output belongs to the caller.

import type { DateTime } from "effect";

import type { TimeRange } from "../analyze/analysis-window.js";
import type { ClassifiedCommit } from "../automation/classify.js";
import type { Report } from "../report/report.js";

type ContributorsInput = {
  /** The window's commits of every class. */
  readonly commits: ReadonlyArray<ClassifiedCommit>;
  readonly window: TimeRange;
  /** Repository-relative scope; "." for the whole repository. Areas are cut relative to it. */
  readonly scope: string;
  /** The `Clock` time that "active" is measured back from. */
  readonly now: DateTime.Utc;
  /** Whether a changed path counts toward added and deleted lines. */
  readonly isCodePath: (path: string) => boolean;
};

/**
 * The `contributors` section, sorted by commits descending, then name. `activeDays`
 * counts distinct local dates; `active` means a commit in the 183 days before
 * `now`; `areas` are the three directories with the most commits, cut at two
 * levels below the scope.
 */
export const contributors = (
  _input: ContributorsInput,
): Report["contributors"] => {
  throw new Error("@scaffold not implemented");
};
