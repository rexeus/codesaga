// Owns the human view of `analyze`: one screen with the headline, highlights, activity, people, automation and languages.
// Every name that came from git or the file system passes through terminal-safe escaping.
import type { Report } from "@codesaga/engine";

import { escapeForTerminal } from "../escape.js";
import {
  ago,
  count,
  day,
  daysBetween,
  plural,
  share,
  signedCount,
  signedPercent,
  signedPoints,
  span,
  sparkline,
} from "./format.js";
import { highlightLines } from "./highlight-lines.js";
import { knowledgeLines } from "./knowledge-lines.js";
import {
  fitEscaped,
  labelledTable,
  MAX_NAME_WIDTH,
  section,
} from "./layout.js";
import { pullRequestLines } from "./pull-request-lines.js";
import type { Style } from "./style.js";
import { plain, renderTable } from "./table.js";

type Comparison = NonNullable<Report["comparison"]>;

const ACTIVITY_MONTHS = 12;
const TOP_CONTRIBUTORS = 5;
const TOP_TOOLS = 3;
const TOP_LANGUAGES = 5;
const SHORT_SHA = 7;
const SEPARATOR = " · ";

const headline = (report: Report): string => {
  const { repository } = report;
  const place =
    repository.head === null
      ? "no commits"
      : `${escapeForTerminal(repository.branch ?? "detached HEAD")} @ ${repository.head.slice(0, SHORT_SHA)}`;
  return ["codesaga", escapeForTerminal(repository.name), place].join(
    SEPARATOR,
  );
};

const summary = (report: Report): string => {
  const { overview, repository } = report;
  const age =
    repository.firstCommitAt === null
      ? []
      : [span(daysBetween(repository.firstCommitAt, report.generatedAt))];
  return [
    ...age,
    plural(overview.commits, "commit"),
    `${plural(overview.contributors.total, "contributor")}, ${count(overview.contributors.active90)} active in 90 days`,
    `${plural(overview.loc, "line")} in ${plural(overview.languages.length, "language")}`,
  ].join(SEPARATOR);
};

/** A change in relative terms, or in counts when the previous span had none to relate to. */
const relativeChange = ({
  change,
  ratio,
}: {
  readonly change: number;
  readonly ratio: number | null;
}): string => (ratio === null ? signedCount(change) : signedPercent(ratio));

/**
 * The deltas of a comparison on one line, named by the dates of the span they
 * compare with. A share of no commits is not a number, so its change reads n/a.
 */
const comparisonLine = ({ previous, delta }: Comparison): string => {
  const deltas = [
    `vs ${day(previous.since)} – ${day(previous.until)}`,
    `commits ${relativeChange(delta.commits)}`,
    `contributors ${signedCount(delta.activeContributors.change)}`,
    `lines added ${relativeChange(delta.added)}`,
    `AI share ${delta.aiShare === null ? "n/a" : signedPoints(delta.aiShare)}`,
  ].join(SEPARATOR);
  return previous.partial
    ? `${deltas} (previous period partly before the first commit)`
    : deltas;
};

const activitySection = (
  report: Report,
  style: Style,
): ReadonlyArray<string> => {
  const months = report.activity.months.slice(-ACTIVITY_MONTHS);
  const commits = months.map((month) => month.commits);
  const total = commits.reduce((sum, value) => sum + value, 0);
  const label =
    months.length === 1
      ? "Activity, last month"
      : `Activity, last ${months.length} months`;
  return section(
    label,
    [`${sparkline(commits)}  ${plural(total, "commit")}`],
    style,
  );
};

const contributorLines = (
  report: Report,
  style: Style,
): ReadonlyArray<string> => {
  const top = report.contributors.slice(0, TOP_CONTRIBUTORS);
  const table = renderTable(
    [
      { header: "commits", align: "right" },
      { header: "active days", align: "right" },
      { header: "last commit", align: "left" },
    ],
    top.map((person) => [
      plain(count(person.commits)),
      plain(count(person.activeDays)),
      plain(ago(person.lastCommitAt, report.generatedAt)),
    ]),
    style,
  );
  return labelledTable(
    "Contributors",
    top.map((person) => fitEscaped(person.name, MAX_NAME_WIDTH)),
    table,
    style,
  );
};

/** The shares and top tools; the caller shows them only when a tool was detected. */
const automationLines = (report: Report): ReadonlyArray<string> => {
  const { totals, tools } = report.automation;
  const all = totals.human + totals.agentAssisted + totals.agent + totals.bot;
  const shares = Object.entries({
    "agent-assisted": totals.agentAssisted,
    agent: totals.agent,
    bot: totals.bot,
  })
    .filter(([, value]) => value > 0)
    .map(([name, value]) => `${name} ${share(value, all)}`);
  const toolNames = tools
    .slice(0, TOP_TOOLS)
    .map(
      (tool) =>
        `${escapeForTerminal(tool.name)} ${count(tool.authored + tool.assisted)}`,
    );
  return [shares.join(SEPARATOR), toolNames.join(SEPARATOR)];
};

const languageLine = (report: Report): string => {
  const { languages, loc } = report.overview;
  return languages.length === 0
    ? "no code files"
    : languages
        .slice(0, TOP_LANGUAGES)
        .map(
          ({ name, loc: lines }) =>
            `${escapeForTerminal(name)} ${share(lines, loc)}`,
        )
        .join(SEPARATOR);
};

/**
 * Renders the terminal view of an `analyze` report. The report must not be
 * cut to `--limit`: the view picks its own top entries. The result has no
 * trailing newline.
 */
export const renderAnalysis = (report: Report, style: Style): string =>
  [
    style.bold(headline(report)),
    summary(report),
    ...(report.comparison === undefined
      ? []
      : [comparisonLine(report.comparison)]),
    "",
    ...highlightLines(report, style),
    ...activitySection(report, style),
    ...contributorLines(report, style),
    ...knowledgeLines(report, style),
    ...(report.automation.tools.length === 0
      ? []
      : section("Automation", automationLines(report), style)),
    ...(report.pullRequests === undefined
      ? []
      : pullRequestLines(report.pullRequests, style)),
    ...section("Languages", [languageLine(report)], style),
    "",
    style.dim("--html for the dashboard, --json for agents"),
  ].join("\n");
