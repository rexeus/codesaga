import { formatCount, formatNoun } from "./format.js";
import type { TypeScriptDeepDive } from "./typescript-summary.js";

type Classes = NonNullable<
  NonNullable<TypeScriptDeepDive["trends"]>["escapesByAutomation"]
>;

const LABELS = [
  ["human", "Human"],
  ["agent-assisted", "Human with an AI agent"],
  ["agent", "AI agent"],
  ["bot", "Bot"],
] as const;

/** What the commits of one class did to the escape hatches. */
type ClassRow = {
  readonly label: string;
  readonly commits: string;
  readonly added: string;
  readonly removed: string;
};

/** The table of commit classes with the sentence that bounds it. */
export type AutomationView = {
  readonly rows: readonly ClassRow[];
  readonly teaser: string;
  readonly caveat: string;
};

/**
 * The escape sites that commits added and removed, by class of commit and
 * never by person. A class without a commit is left out; null when no class
 * changed any TypeScript, which leaves nothing to tell.
 */
export const automationView = (classes: Classes): AutomationView | null => {
  const rows = LABELS.flatMap(([key, label]) => {
    const { commits, added, removed } = classes[key];
    return commits === 0
      ? []
      : [
          {
            label,
            commits: formatNoun(commits, "commit"),
            added: formatCount(added),
            removed: formatCount(removed),
          },
        ];
  });
  if (rows.length === 0) {
    return null;
  }
  const total = (pick: (value: Classes["human"]) => number): number =>
    LABELS.reduce((sum, [key]) => sum + pick(classes[key]), 0);
  return {
    rows,
    teaser: `${formatNoun(
      total(({ added }) => added),
      "site",
    )} added and ${formatCount(total(({ removed }) => removed))} removed by ${formatNoun(
      total(({ commits }) => commits),
      "commit",
    )}`,
    caveat:
      "A commit without an agent marker counts as human, so the agent figures are lower bounds. Added and removed are the sums of each commit's net change in escape sites. Classes of commits only, never people.",
  };
};
