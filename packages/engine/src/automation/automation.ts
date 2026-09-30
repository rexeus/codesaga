// Owns the automation section: how many commits humans, agents and bots made, per month and per tool.
// It counts what classification found; "not detected" stays in the human numbers.
// One entry per tool and per month of the window.

import type { TimeRange } from "../analyze/analysis-window.js";
import type { Report } from "../report/report.js";
import type { ClassifiedCommit } from "./classify.js";

type AutomationInput = {
  /** The window's commits of every class. */
  readonly commits: ReadonlyArray<ClassifiedCommit>;
  readonly window: TimeRange;
};

/**
 * The `automation` section: totals and per-month counts by class (every month
 * of the window, empty ones with zeros), and per tool the commits it authored
 * and the human commits it assisted, most commits first.
 */
export const automation = (_input: AutomationInput): Report["automation"] => {
  throw new Error("@scaffold not implemented");
};
