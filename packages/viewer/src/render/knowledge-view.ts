import type { Report } from "@codesaga/engine";

import { formatCount } from "../present/format.js";
import {
  coverageSentence,
  directoryBadges,
  expertLine,
  truckFactorPeople,
  truckFactorSentence,
} from "../present/knowledge.js";
import type { Badge, PersonLine } from "../present/knowledge.js";
import { h } from "./dom.js";
import { section } from "./section.js";
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

const status = (directory: Directory): HTMLElement =>
  h(
    "div",
    "status",
    h(
      "div",
      "badges",
      ...directoryBadges(directory).map((flag) => badge(flag)),
    ),
    ...(directory.reasons.length === 0
      ? []
      : [
          h(
            "ul",
            "plain reasons",
            ...directory.reasons.map((reason) => h("li", "muted", reason)),
          ),
        ]),
  );

const columns: readonly Column<Directory>[] = [
  { label: "Directory", cell: ({ path }) => h("code", "", path) },
  { label: "Files", numeric: true, cell: ({ files }) => formatCount(files) },
  {
    label: "Truck factor",
    numeric: true,
    cell: ({ truckFactor }) => formatCount(truckFactor),
  },
  { label: "Status", cell: status },
  { label: "Experts", cell: experts },
];

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
    "Who knows the code, and whether they are still around. Covers the whole history.",
    h("p", "", coverageSentence(knowledge)),
    ...(knowledge.truckFactor.people.length === 0
      ? []
      : [truckFactorPanel(knowledge)]),
    knowledge.directories.length === 0
      ? h("p", "empty", "No directory is large enough to report.")
      : dataTable(
          "Directories by knowledge risk",
          columns,
          knowledge.directories,
        ),
    ...(limited === null ? [] : [h("p", "note", limited)]),
    h(
      "p",
      "note",
      "Expertise is an estimate from the history, not a fact. An island is a directory where one person is the sole expert on most files; orphaned means most files have no active expert.",
    ),
  );
};
