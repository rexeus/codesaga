import type { Report } from "@codesaga/engine";

import {
  formatAge,
  formatCount,
  formatPercent,
  formatSignedCount,
  formatSignedPercent,
  formatSignedPoints,
} from "./format.js";

/** One headline tile: a label, the figure, and what it is made of. */
export type KeyFigure = {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
  /** The change from the previous period, signed and named; undefined without `--compare`. */
  readonly delta: string | undefined;
};

type Comparison = NonNullable<Report["comparison"]>;

const VS_PREVIOUS = "vs previous period";

const against = (change: string): string => `${change} ${VS_PREVIOUS}`;

/** A relative change, or the count itself when the previous period had nothing to relate to. */
const relativeChange = ({
  change,
  ratio,
}: Comparison["delta"]["commits"]): string =>
  ratio === null ? formatSignedCount(change) : formatSignedPercent(ratio);

const NOT_AVAILABLE = "–";

const age = ({ repository, generatedAt }: Report): KeyFigure => ({
  label: "Age",
  value:
    repository.firstCommitAt === null
      ? NOT_AVAILABLE
      : formatAge(repository.firstCommitAt, generatedAt),
  detail: "since the first commit",
  delta: undefined,
});

/** AI share of the window's commits: agent-authored plus agent-assisted. */
const aiShare = ({ automation, window, comparison }: Report): KeyFigure => {
  const { agent, agentAssisted } = automation.totals;
  const aiCommits = agent + agentAssisted;
  return {
    label: "AI share",
    value:
      window.commits === 0
        ? NOT_AVAILABLE
        : formatPercent(aiCommits / window.commits),
    detail: `${formatCount(aiCommits)} detected, a lower bound`,
    delta:
      comparison === undefined
        ? undefined
        : against(formatSignedPoints(comparison.delta.aiShare)),
  };
};

/**
 * The six tiles at the top of the dashboard. Every figure comes from one
 * report field (the AI share from two), so each can be checked against the
 * embedded JSON.
 */
export const keyFigures = (report: Report): KeyFigure[] => {
  const { overview, knowledge, comparison } = report;
  return [
    age(report),
    {
      label: "Commits",
      value: formatCount(overview.commits),
      detail: "in the window",
      delta:
        comparison === undefined
          ? undefined
          : against(relativeChange(comparison.delta.commits)),
    },
    {
      label: "Active contributors",
      value: formatCount(overview.contributors.active90),
      detail: `in 90 days, of ${formatCount(overview.contributors.total)}`,
      delta:
        comparison === undefined
          ? undefined
          : against(
              `${formatSignedCount(comparison.delta.activeContributors.change)} contributors in window`,
            ),
    },
    {
      label: "Truck factor",
      value: formatCount(knowledge.truckFactor.value),
      detail: "people the code depends on",
      delta: undefined,
    },
    aiShare(report),
    {
      label: "Lines of code",
      value: formatCount(overview.loc),
      detail: `in ${formatCount(overview.files)} files`,
      delta: undefined,
    },
  ];
};
