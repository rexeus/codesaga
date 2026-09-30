// Owns the knowledge block of the `analyze` view: the truck factor with its people, then the riskiest directories.
// Every name and path that came from git passes through terminal-safe escaping.
import type { Report } from "@codesaga/engine";

import { escapeForTerminal } from "../escape.js";
import { share } from "./format.js";
import { fit, labelledTable, MAX_NAME_WIDTH, section } from "./layout.js";
import type { Style } from "./style.js";
import { plain, renderTable } from "./table.js";

const TOP_DIRECTORIES = 5;
const MAX_PATH_WIDTH = 24;

type Knowledge = Report["knowledge"];
type Directory = Knowledge["directories"][number];
type Expert = Directory["experts"][number];

const INACTIVE = " (inactive)";

const nameOf = (person: { name: string }): string =>
  fit(escapeForTerminal(person.name), MAX_NAME_WIDTH);

const inactiveMark = (person: { active: boolean }): string =>
  person.active ? "" : INACTIVE;

const truckFactorLine = ({ truckFactor }: Knowledge): string =>
  truckFactor.value === 0
    ? "0 · most files have no expert"
    : `${truckFactor.value} · ${truckFactor.people
        .map((person) => `${nameOf(person)}${inactiveMark(person)}`)
        .join(", ")}`;

const badgesOf = ({ island, orphaned }: Directory): string =>
  [...(orphaned ? ["orphaned"] : []), ...(island ? ["island"] : [])].join(", ");

const leadingExpert = (directory: Directory): string => {
  const [top]: ReadonlyArray<Expert> = directory.experts;
  return top === undefined
    ? "no expert"
    : `${nameOf(top)} ${share(top.files, directory.files)}${inactiveMark(top)}`;
};

const directoryLines = (
  { directories }: Knowledge,
  style: Style,
): ReadonlyArray<string> => {
  const top = directories.slice(0, TOP_DIRECTORIES);
  return labelledTable(
    "Knowledge risks",
    top.map((directory) =>
      fit(escapeForTerminal(directory.path), MAX_PATH_WIDTH),
    ),
    renderTable(
      [
        { header: "files", align: "right" },
        { header: "flags", align: "left" },
        { header: "leading expert", align: "left" },
      ],
      top.map((directory) => [
        plain(String(directory.files)),
        plain(badgesOf(directory)),
        plain(leadingExpert(directory)),
      ]),
      style,
    ),
    style,
  );
};

/** The knowledge block: the truck factor, and the five riskiest directories when there are any. */
export const knowledgeLines = (
  report: Report,
  style: Style,
): ReadonlyArray<string> => [
  ...section("Truck factor", [truckFactorLine(report.knowledge)], style),
  ...(report.knowledge.directories.length === 0
    ? []
    : directoryLines(report.knowledge, style)),
];
