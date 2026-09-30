import type { Report } from "@codesaga/engine";

import {
  areaLabel,
  naturalDirection,
  sortContributors,
} from "../present/contributors.js";
import { formatCount, formatDate } from "../present/format.js";
import { h } from "./dom.js";
import { section } from "./section.js";
import { dataTable } from "./table.js";
import type { Column } from "./table.js";

type Contributor = Report["contributors"][number];

const person = ({ name, email }: Contributor): HTMLElement =>
  h("div", "person", h("strong", "", name), h("span", "muted", email));

const areas = ({ areas: top }: Contributor): string =>
  top
    .map(({ path, commits }) => `${areaLabel(path)} (${formatCount(commits)})`)
    .join(", ");

const status = ({ active }: Contributor): HTMLElement =>
  h(
    "span",
    `badge ${active ? "active" : "inactive"}`,
    active ? "● Active" : "○ Inactive",
  );

const number = (
  label: string,
  sortKey: string,
  value: (row: Contributor) => number,
): Column<Contributor> => ({
  label,
  sortKey,
  numeric: true,
  cell: (row) => formatCount(value(row)),
});

const columns: readonly Column<Contributor>[] = [
  { label: "Contributor", sortKey: "name", cell: person },
  number("Commits", "commits", ({ commits }) => commits),
  number("Active days", "activeDays", ({ activeDays }) => activeDays),
  number("Lines added", "added", ({ added }) => added),
  number("Lines deleted", "deleted", ({ deleted }) => deleted),
  {
    label: "First commit",
    sortKey: "firstCommitAt",
    cell: ({ firstCommitAt }) => formatDate(firstCommitAt),
  },
  {
    label: "Last commit",
    sortKey: "lastCommitAt",
    cell: ({ lastCommitAt }) => formatDate(lastCommitAt),
  },
  { label: "Main areas", sortKey: "areas", cell: areas },
  { label: "Status", sortKey: "active", cell: status },
];

const truncation = ({ contributors, totals }: Report): string | null =>
  totals.contributors > contributors.length
    ? `Showing ${formatCount(contributors.length)} of ${formatCount(totals.contributors)} contributors: the report was limited.`
    : null;

/** Everyone with a human or agent-assisted commit in the window, sortable by any column. */
export const renderContributors = (report: Report): HTMLElement => {
  const limited = truncation(report);
  return section(
    "contributors",
    "Contributors",
    "People with a commit in the window. Counts give context, not a ranking.",
    report.contributors.length === 0
      ? h("p", "empty", "No contributors in the window.")
      : dataTable("Contributors", columns, report.contributors, {
          initial: { key: "commits", direction: "desc" },
          sort: sortContributors,
          natural: naturalDirection,
        }),
    ...(limited === null ? [] : [h("p", "note", limited)]),
  );
};
