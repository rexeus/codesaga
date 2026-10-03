// Owns what commits of each class did to the escape hatches: added and removed, per commit and as a net sum over its files.
// Moves between files cancel out in a commit's sum. The counts are never shown per person.
import type { ClassifiedCommit } from "../../automation/classify.js";
import type { Trends } from "../../report/typescript-trends.js";
import { changeFactsOf } from "./facts-lookup.js";
import type { FactsLookup } from "./facts-lookup.js";

type ClassEscapes = Trends["escapesByAutomation"]["human"];

/** The net change of escape sites over a commit's files that the facts cover, or undefined when none is one. */
const netEscapesOf = (
  commit: Pick<ClassifiedCommit, "changes">,
  lookup: FactsLookup,
): number | undefined => {
  const covered = commit.changes.flatMap((change) => {
    const facts = changeFactsOf(change, lookup);
    return facts === undefined ||
      (facts.before === null && facts.after === null)
      ? []
      : [(facts.after?.escapes ?? 0) - (facts.before?.escapes ?? 0)];
  });
  return covered.length === 0
    ? undefined
    : covered.reduce((sum, delta) => sum + delta, 0);
};

const empty = (): ClassEscapes => ({ commits: 0, added: 0, removed: 0 });

/**
 * The escape sites that `commits` added and removed, by class. A commit
 * counts when it changed a file the facts cover; a file whose version before
 * or after has no facts leaves the commit's sum out of that file.
 */
export const escapesByAutomation = (
  commits: ReadonlyArray<Pick<ClassifiedCommit, "class" | "changes">>,
  lookup: FactsLookup,
): Trends["escapesByAutomation"] => {
  const totals = {
    human: empty(),
    "agent-assisted": empty(),
    agent: empty(),
    bot: empty(),
  };
  for (const commit of commits) {
    const net = netEscapesOf(commit, lookup);
    if (net !== undefined) {
      const total = totals[commit.class];
      totals[commit.class] = {
        commits: total.commits + 1,
        added: total.added + Math.max(net, 0),
        removed: total.removed + Math.max(-net, 0),
      };
    }
  }
  return totals;
};
