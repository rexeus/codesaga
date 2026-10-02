import type { Report } from "@codesaga/engine";

import { formatCount } from "../present/format.js";
import {
  coverageSentence,
  directoryBadges,
  expertLine,
  hasLineOwners,
  lineOwnerLine,
  soleExpertSummary,
  truckFactorPeople,
  truckFactorSentence,
} from "../present/knowledge.js";
import type { Badge, PersonLine } from "../present/knowledge.js";
import type { RowLimit } from "../present/row-limit.js";
import { h } from "./dom.js";
import { panel, section } from "./section.js";
import { dataTable } from "./table.js";
import type { Column } from "./table.js";

type Directory = Report["knowledge"]["directories"][number];

const marker = ({ active }: PersonLine): HTMLElement =>
  h("span", `marker ${active ? "active" : "inactive"}`, active ? "●" : "○");

const badge = ({ kind, label, symbol }: Badge): HTMLElement =>
  h("span", `badge flag-${kind}`, h("span", "symbol", symbol), label);

const person = (
  line: PersonLine,
  ...rest: readonly (Node | string)[]
): HTMLElement =>
  h(
    "li",
    `person-line ${line.active ? "" : "inactive"}`,
    marker(line),
    h("strong", "", line.name),
    ...rest,
    h("span", "muted", line.status),
  );

const experts = ({ experts: list }: Directory): HTMLElement =>
  h(
    "ul",
    "plain",
    ...list.map((expert) => {
      const line = expertLine(expert);
      return person(line, h("span", "", line.detail));
    }),
  );

const lineOwners = ({ lineOwners: owned }: Directory): HTMLElement | string =>
  owned === undefined
    ? ""
    : h(
        "ul",
        "plain",
        ...owned.owners.map((owner) => {
          const line = lineOwnerLine(owner);
          return h(
            "li",
            "person-line",
            h("strong", "", line.name),
            h("span", "", line.detail),
            ...(line.mark === "" ? [] : [h("span", "muted", line.mark)]),
          );
        }),
      );

const status =
  (showReasons: boolean) =>
  (directory: Directory): HTMLElement =>
    h(
      "div",
      "status",
      h(
        "div",
        "badges",
        ...directoryBadges(directory).map((flag) => badge(flag)),
      ),
      ...(!showReasons || directory.reasons.length === 0
        ? []
        : [
            h(
              "ul",
              "plain reasons",
              ...directory.reasons.map((reason) => h("li", "muted", reason)),
            ),
          ]),
    );

const columns = (
  showReasons: boolean,
  blamed: boolean,
): readonly Column<Directory>[] => [
  { label: "Directory", cell: ({ path }) => h("code", "", path) },
  { label: "Files", numeric: true, cell: ({ files }) => formatCount(files) },
  {
    label: "Truck factor",
    numeric: true,
    cell: ({ truckFactor }) => formatCount(truckFactor),
  },
  { label: "Status", cell: status(showReasons) },
  { label: "Experts", cell: experts },
  ...(blamed ? [{ label: "Line owners", cell: lineOwners }] : []),
];

const ROW_LIMIT: RowLimit = { rows: 10, noun: "directories" };

const directoryTable = (knowledge: Report["knowledge"]): HTMLElement[] => {
  const summary = soleExpertSummary(knowledge);
  return [
    ...(summary === null ? [] : [h("p", "", summary)]),
    dataTable(
      "Directories by knowledge risk",
      columns(summary === null, hasLineOwners(knowledge)),
      knowledge.directories,
      { rowLimit: ROW_LIMIT },
    ),
  ];
};

const truckFactorPanel = (knowledge: Report["knowledge"]): HTMLElement =>
  h(
    "div",
    "truck-factor",
    h("p", "", truckFactorSentence(knowledge)),
    h(
      "ol",
      "plain people",
      ...truckFactorPeople(knowledge).map((line) => person(line)),
    ),
  );

const truncation = ({ knowledge, totals }: Report): string | null =>
  totals.directories > knowledge.directories.length
    ? `Showing the ${formatCount(knowledge.directories.length)} riskiest of ${formatCount(totals.directories)} directories: the report was limited.`
    : null;

/** Who knows the code and whether they are still around: the truck factor and the riskiest directories. */
export const renderKnowledge = (report: Report): HTMLElement => {
  const { knowledge } = report;
  const limited = truncation(report);
  return section(
    "knowledge",
    "Knowledge",
    "Who knows which part",
    "Who knows the code, and whether they are still around. Covers the whole history.",
    panel(
      h("p", "", coverageSentence(knowledge)),
      ...(knowledge.truckFactor.people.length === 0
        ? []
        : [truckFactorPanel(knowledge)]),
      ...(knowledge.directories.length === 0
        ? [h("p", "empty", "No directory is large enough to report.")]
        : directoryTable(knowledge)),
      ...(limited === null ? [] : [h("p", "note", limited)]),
      ...(hasLineOwners(knowledge)
        ? [
            h(
              "p",
              "note",
              "Line owners count the lines at HEAD that git blame attributes to each author. Unlike experts, bots and agents own lines too.",
            ),
          ]
        : []),
      h(
        "p",
        "note",
        "Expertise is an estimate from the history, not a fact. An island is a directory where one person is the sole expert on most files; orphaned means most files have no active expert.",
      ),
    ),
  );
};
