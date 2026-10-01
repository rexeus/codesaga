// Owns the automation section: how many commits humans, agents and bots made, per month and per tool.
// It counts what classification found; "not detected" stays in the human numbers.
// One entry per tool and per month of the window. A commit counts once in the class
// totals and once for each of its tools, so per-tool counts can add up to more than the totals.

import { Order } from "effect";

import { monthOf, monthsOf } from "../activity/buckets.js";
import type { TimeRange } from "../analyze/analysis-window.js";
import { groupBy } from "../collections/group-by.js";
import type { Report } from "../report/report.js";
import type { ClassifiedCommit } from "./classify.js";

type AutomationInput = {
  /** The window's commits of every class. */
  readonly commits: ReadonlyArray<ClassifiedCommit>;
  readonly window: TimeRange;
};

type Totals = Report["automation"]["totals"];
type Tool = Report["automation"]["tools"][number];

const countOf = (
  commits: ReadonlyArray<ClassifiedCommit>,
  commitClass: ClassifiedCommit["class"],
): number => commits.filter((commit) => commit.class === commitClass).length;

export const totalsOf = (commits: ReadonlyArray<ClassifiedCommit>): Totals => ({
  human: countOf(commits, "human"),
  agentAssisted: countOf(commits, "agent-assisted"),
  agent: countOf(commits, "agent"),
  bot: countOf(commits, "bot"),
});

const byCommitsThenName = Order.combine(
  Order.flip(
    Order.mapInput(Order.Number, (tool: Tool) => tool.authored + tool.assisted),
  ),
  Order.mapInput(Order.String, (tool: Tool) => tool.name),
);

/** The tool name of the newest commit; equal times keep the later entry, as identities do. */
const newestNameOf = (
  commits: ReadonlyArray<{ readonly tool: string; readonly time: number }>,
): string =>
  commits.reduce((newest, commit) =>
    commit.time >= newest.time ? commit : newest,
  ).tool;

const toolsOf = (
  commits: ReadonlyArray<ClassifiedCommit>,
): Report["automation"]["tools"] =>
  [
    ...groupBy(
      commits.flatMap((commit) =>
        commit.tools.map((tool) => ({ ...commit, tool })),
      ),
      (commit) => commit.tool.toLowerCase(),
    ).values(),
  ]
    .map((own): Tool => ({
      name: newestNameOf(own),
      kind: countOf(own, "bot") > 0 ? "bot" : "agent",
      authored: countOf(own, "agent") + countOf(own, "bot"),
      assisted: countOf(own, "agent-assisted"),
    }))
    .toSorted(byCommitsThenName);

/**
 * The `automation` section: totals and per-month counts by class (every month
 * of the window, empty ones with zeros), and per tool the commits it authored
 * and the human commits it assisted, most commits first. A commit that several
 * agents assisted counts once in the totals and once for each of them. A bot matched only
 * by the generic `[bot]` rule is listed under its account name, which matches
 * case-insensitively and shows the newest spelling.
 */
export const automation = ({
  commits,
  window,
}: AutomationInput): Report["automation"] => {
  const byMonth = groupBy(commits, (commit) => monthOf(commit.time));
  return {
    totals: totalsOf(commits),
    months: monthsOf(window).map((month) =>
      Object.assign({ month }, totalsOf(byMonth.get(month) ?? [])),
    ),
    tools: toolsOf(commits),
  };
};
