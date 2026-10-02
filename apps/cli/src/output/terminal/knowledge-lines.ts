// Owns the knowledge block of the `analyze` view: the truck factor with its people, then the riskiest areas at the chosen depth.
// Every name and path that came from git passes through terminal-safe escaping.
import type { Report } from "@codesaga/engine";

import { share } from "./format.js";
import {
  fitEscaped,
  labelledTable,
  MAX_NAME_WIDTH,
  section,
} from "./layout.js";
import type { Style } from "./style.js";
import { plain, renderTable } from "./table.js";
import type { Column } from "./table.js";

const TOP_AREAS = 5;
const MAX_PATH_WIDTH = 24;
const MAX_TRUCK_FACTOR_NAMES = 3;

type Knowledge = Report["knowledge"];
type Area = Knowledge["areas"]["levels"][number]["areas"][number];
type Expert = Area["experts"][number];
type LineOwners = NonNullable<Area["lineOwners"]>;

const LINE_OWNER_COLUMN: Column = {
  header: "leading line owner",
  align: "left",
};
const INACTIVE = " (inactive)";

/** A person's name, escaped and cut to the name column. */
export const nameOf = (person: { name: string }): string =>
  fitEscaped(person.name, MAX_NAME_WIDTH);

const inactiveMark = (person: { active: boolean }): string =>
  person.active ? "" : INACTIVE;

const truckFactorLine = ({ truckFactor }: Knowledge): string => {
  if (truckFactor.value === 0) {
    return "0 · most files have no expert";
  }
  const named = truckFactor.people
    .slice(0, MAX_TRUCK_FACTOR_NAMES)
    .map((person) => `${nameOf(person)}${inactiveMark(person)}`);
  const more = truckFactor.people.length - named.length;
  const people =
    more > 0 ? `${named.join(", ")} and ${more} more` : named.join(", ");
  return `${truckFactor.value} · ${people}`;
};

/** `orphaned, island`: the flags of a file set, riskiest first; empty for neither. */
export const badgesOf = ({
  island,
  orphaned,
}: {
  island: boolean;
  orphaned: boolean;
}): string =>
  [...(orphaned ? ["orphaned"] : []), ...(island ? ["island"] : [])].join(", ");

const leadingExpert = (area: Area): string => {
  const [top]: ReadonlyArray<Expert> = area.experts;
  return top === undefined
    ? "no expert"
    : `${nameOf(top)} ${share(top.files, area.files)}${inactiveMark(top)}`;
};

/** An owner's name, marked when the account is an agent or a bot. */
export const ownerLabel = (owner: LineOwners["owners"][number]): string =>
  owner.kind === "human" ? nameOf(owner) : `${nameOf(owner)} (${owner.kind})`;

const leadingLineOwner = (lineOwners: LineOwners | undefined): string => {
  if (lineOwners === undefined) {
    return "";
  }
  const [top] = lineOwners.owners;
  return top === undefined
    ? "none"
    : `${ownerLabel(top)} ${share(top.lines, lineOwners.lines)}`;
};

const OTHER_FILES = " (other)";

/** The area's path, escaped and cut to the column; the small areas of a directory are marked as its other files. */
const areaLabel = ({ path, kind }: Area): string =>
  kind === "rest"
    ? `${fitEscaped(path, MAX_PATH_WIDTH - OTHER_FILES.length)}${OTHER_FILES}`
    : fitEscaped(path, MAX_PATH_WIDTH);

const areaLines = (
  { areas }: Knowledge,
  style: Style,
): ReadonlyArray<string> => {
  const level = areas.levels.find(({ depth }) => depth === areas.depth);
  const top = (level?.areas ?? []).slice(0, TOP_AREAS);
  if (top.length === 0) {
    return [];
  }
  const blamed = top.some((area) => area.lineOwners !== undefined);
  const columns: ReadonlyArray<Column> = [
    { header: "files", align: "right" },
    { header: "flags", align: "left" },
    { header: "leading expert", align: "left" },
    ...(blamed ? [LINE_OWNER_COLUMN] : []),
  ];
  return [
    ...labelledTable(
      "Knowledge areas",
      top.map((area) => areaLabel(area)),
      renderTable(
        columns,
        top.map((area) =>
          [
            plain(String(area.files)),
            plain(badgesOf(area)),
            plain(leadingExpert(area)),
          ].concat(blamed ? [plain(leadingLineOwner(area.lineOwners))] : []),
        ),
        style,
      ),
      style,
    ),
    ...section(
      "",
      [
        style.dim(
          `Areas at level ${areas.depth} of ${areas.levels.length} (recommended: ${areas.recommendedDepth})`,
        ),
        style.dim(areas.reason),
      ],
      style,
    ),
  ];
};

/**
 * The one line that replaces the whole block in a repository with a single
 * contributor, where every directory is an island by construction; `null` otherwise.
 */
const soleContributorLine = (report: Report): string | null => {
  const { truckFactor } = report.knowledge;
  const [only] = truckFactor.people;
  return report.overview.contributors.total === 1 &&
    truckFactor.value === 1 &&
    only !== undefined
    ? `one contributor — ${nameOf(only)}${inactiveMark(only)} is the only expert everywhere`
    : null;
};

/**
 * The knowledge block: the truck factor, and the five riskiest areas of the chosen level when there are any.
 * A single-contributor repository gets one line instead.
 */
export const knowledgeLines = (
  report: Report,
  style: Style,
): ReadonlyArray<string> => {
  const sole = soleContributorLine(report);
  if (sole !== null) {
    return section("Knowledge", [sole], style);
  }
  return [
    ...section("Truck factor", [truckFactorLine(report.knowledge)], style),
    ...areaLines(report.knowledge, style),
  ];
};
