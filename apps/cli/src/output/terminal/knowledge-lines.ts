// Owns the knowledge block of the `analyze` view: the truck factor with its people, then the riskiest territories at the chosen detail as a small tree.
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

const TOP_TERRITORIES = 5;
const TOP_CHILDREN = 4;
const MAX_PATH_WIDTH = 24;
const CHILD_INDENT = "  ";
const MAX_TRUCK_FACTOR_NAMES = 3;

type Knowledge = Report["knowledge"];
type Territory = Knowledge["territories"]["territories"][number];
type Expert = Territory["experts"][number];
type LineOwners = NonNullable<Territory["lineOwners"]>;

const LINE_OWNER_COLUMN: Column = {
  header: "leading line owner",
  align: "left",
};
const DORMANT = " (dormant)";

/** A person's name, escaped and cut to the name column. */
export const nameOf = (person: { name: string }): string =>
  fitEscaped(person.name, MAX_NAME_WIDTH);

const dormantMark = (person: { active: boolean }): string =>
  person.active ? "" : DORMANT;

const truckFactorLine = ({ truckFactor }: Knowledge): string => {
  if (truckFactor.value === 0) {
    return "0 · most files have no expert";
  }
  const named = truckFactor.people
    .slice(0, MAX_TRUCK_FACTOR_NAMES)
    .map((person) => `${nameOf(person)}${dormantMark(person)}`);
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

const leadingExpert = (territory: Territory): string => {
  const [top]: ReadonlyArray<Expert> = territory.experts;
  return top === undefined
    ? "no expert"
    : `${nameOf(top)} ${share(top.files, territory.files)}${dormantMark(top)}`;
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

/** The territory's path, escaped and cut to the column; the small territories of a directory are marked as its other files. */
const territoryLabel = ({ path, kind }: Territory): string =>
  kind === "other"
    ? `${fitEscaped(path, MAX_PATH_WIDTH - OTHER_FILES.length)}${OTHER_FILES}`
    : fitEscaped(path, MAX_PATH_WIDTH);

/** A child's path below its parent, escaped and cut to the column; its other files are named as such. */
const childLabel = (child: Territory, parent: Territory): string =>
  child.kind === "other"
    ? "other files"
    : fitEscaped(
        child.path.startsWith(`${parent.path}/`)
          ? child.path.slice(parent.path.length + 1)
          : child.path,
        MAX_PATH_WIDTH - CHILD_INDENT.length,
      );

type Row = { readonly label: string; readonly territory: Territory };

/** Whether the territory is shown through its children at `detail`. */
const isOpen = ({ splitDetail }: Territory, detail: number): boolean =>
  splitDetail !== undefined && splitDetail <= detail;

/** The row of a first-cut territory and, when it is open at `detail`, the rows of its riskiest children. */
const rowsOf = (root: Territory, detail: number): ReadonlyArray<Row> => {
  const children = isOpen(root, detail)
    ? root.territories.slice(0, TOP_CHILDREN).map((child) => ({
        label: `${CHILD_INDENT}${childLabel(child, root)}`,
        territory: child,
      }))
    : [];
  return [{ label: territoryLabel(root), territory: root }, ...children];
};

/**
 * The riskiest first-cut territories and, below each one that is open at the
 * detail, its riskiest children: two levels, however deep the tree goes.
 */
const territoryRows = ({
  territories,
  detail,
}: Knowledge["territories"]): ReadonlyArray<Row> =>
  territories.slice(0, TOP_TERRITORIES).flatMap((root) => rowsOf(root, detail));

const territoryLines = (
  { territories }: Knowledge,
  style: Style,
): ReadonlyArray<string> => {
  const rows = territoryRows(territories);
  if (rows.length === 0) {
    return [];
  }
  const blamed = rows.some(
    ({ territory }) => territory.lineOwners !== undefined,
  );
  const columns: ReadonlyArray<Column> = [
    { header: "files", align: "right" },
    { header: "flags", align: "left" },
    { header: "leading expert", align: "left" },
    ...(blamed ? [LINE_OWNER_COLUMN] : []),
  ];
  return [
    ...labelledTable(
      "Knowledge territories",
      rows.map(({ label }) => label),
      renderTable(
        columns,
        rows.map(({ territory }) =>
          [
            plain(String(territory.files)),
            plain(badgesOf(territory)),
            plain(leadingExpert(territory)),
          ].concat(
            blamed ? [plain(leadingLineOwner(territory.lineOwners))] : [],
          ),
        ),
        style,
      ),
      style,
    ),
    ...section(
      "",
      [
        style.dim(
          `Territories at detail ${territories.detail} of ${territories.maxDetail} (recommended: ${territories.recommendedDetail})`,
        ),
        style.dim(territories.reason),
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
    ? `one contributor — ${nameOf(only)}${dormantMark(only)} is the only expert everywhere`
    : null;
};

/**
 * The knowledge block: the truck factor, and the five riskiest territories of the chosen detail when there are any.
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
    ...territoryLines(report.knowledge, style),
  ];
};
