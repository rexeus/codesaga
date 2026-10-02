import type { Report } from "@codesaga/engine";

import { territoryBadges } from "./badges.js";
import type { BadgeRow } from "./badges.js";
import { formatAgo, formatPercent } from "./format.js";
import { personEntities } from "./people.js";
import type { Territory } from "./territory-details.js";
import { insideOf, territoryKey } from "./territory-tree.js";
import type { Inside } from "./territory-tree.js";

/** How many first-cut cards are drawn before the reader asks for all. */
export const TERRITORY_CARDS_SHOWN = 12;
const EXPERTS_SHOWN = 3;
/** A territory at or below this truck factor counts as risky. */
export const LOW_TRUCK_FACTOR = 2;

/** One expert of a territory as a bar segment and a row. */
export type ExpertView = {
  readonly name: string;
  readonly entity: string;
  readonly active: boolean;
  /** The share of the territory's files the person is an expert on: `45%`. */
  readonly share: string;
  /** The segment's weight in the bar. */
  readonly weight: number;
};

/** A line owner of a territory, as `git blame` attributes the lines at HEAD. */
type OwnerView = {
  readonly name: string;
  readonly share: string;
  readonly kind: "human" | "agent" | "bot";
};

/** One territory as a card: where it is, how big, how safe, who knows it, and its badges. */
export type TerritoryView = {
  /** The territory as the report has it: its code stats and the territories inside it. */
  readonly node: Territory;
  /** Identifies the territory in the whole tree, see `territoryKey`. */
  readonly key: string;
  /** The path above the territory with its trailing slash, dimmed: `packages/`. */
  readonly parent: string;
  /** The territory's own name: `db/`, or `/ (root)` for the repository root. */
  readonly leaf: string;
  /** The small territories below `path`, grouped as "other files". */
  readonly other: boolean;
  /** The scoped file itself, when `analyze` was given a file: a territory of one file, named without a trailing slash. */
  readonly file: boolean;
  /** The territories it splits into, or null when it does not split. */
  readonly inside: Inside | null;
  readonly files: number;
  /** When anyone last changed a file of the territory: `5 weeks ago`. */
  readonly changed: string;
  /** The territory's share of all universe files: `19%`. */
  readonly share: string;
  /** The share as a fraction of the biggest of its sibling territories, for the solo card's size bar. */
  readonly sizeFraction: number;
  readonly truckFactor: number;
  readonly risk: "crit" | "warn" | "none";
  /** The three experts on the most files; the bar shows all of the engine's. */
  readonly experts: readonly ExpertView[];
  readonly segments: readonly ExpertView[];
  /** The bar's weight not held by an expert: files without one, and everything beyond the engine's five. */
  readonly unclaimed: number;
  readonly moreExperts: number;
  /** The three authors with the most lines; null without `--blame`. Bots and agents own lines too. */
  readonly lineOwners: readonly OwnerView[] | null;
  readonly badges: BadgeRow;
};

const parentOf = (
  path: string,
  file: boolean,
): { parent: string; leaf: string } => {
  if (path === ".") {
    return { parent: "", leaf: "/ (root)" };
  }
  const steps = path.split("/");
  const leaf = `${steps.pop() ?? ""}${file ? "" : "/"}`;
  return { parent: steps.length === 0 ? "" : `${steps.join("/")}/`, leaf };
};

/** A share of the files as a whole percent, `<1%` rather than `0%` for a few files. */
const shareOfFiles = (files: number, total: number): string => {
  const share = files / Math.max(1, total);
  return files > 0 && share < 0.005 ? "<1%" : formatPercent(share);
};

const riskOf = (truckFactor: number): TerritoryView["risk"] => {
  if (truckFactor <= 1) {
    return "crit";
  }
  return truckFactor === LOW_TRUCK_FACTOR ? "warn" : "none";
};

/**
 * A repository with one contributor in its whole history: every territory has the
 * same one expert, so expertise and its risks say nothing. The knowledge
 * covers the full history, so a window that shows one author does not make
 * a team solo.
 */
export const isSolo = ({ overview }: Report): boolean =>
  overview.contributors.allTime === 1;

/** The achievements that still mean something when one person did everything. */
const SOLO_BADGES = new Set([
  "new-territory",
  "in-focus",
  "quiet",
  "heavyweight",
  "hotspot",
  "churning",
  "deeply-nested",
  "well-tested",
]);

const isFile = (
  { kind, path, files }: Territory,
  { repository }: Report,
): boolean => kind === "folder" && files === 1 && path === repository.scope;

/**
 * The cards of `territories` in the engine's order (riskiest first, other
 * files last), sized against the report's files and dated against its day. A
 * solo repository keeps only the badges that do not rest on several people.
 */
export const territoryViews = (
  territories: ReadonlyArray<Territory>,
  report: Report,
): TerritoryView[] => {
  const totalFiles = report.knowledge.files;
  const now = report.generatedAt;
  const solo = isSolo(report);
  const entityOf = personEntities(report.contributors);
  const biggest = Math.max(1, ...territories.map(({ files }) => files));
  return territories.map((territory) => {
    const segments = territory.experts.map(
      ({ name, email, active, files, share }): ExpertView => ({
        name,
        entity: entityOf(email),
        active,
        share: formatPercent(share),
        weight: files,
      }),
    );
    const claimed = segments.reduce((sum, { weight }) => sum + weight, 0);
    return {
      node: territory,
      key: territoryKey(territory),
      ...parentOf(territory.path, isFile(territory, report)),
      other: territory.kind === "other",
      file: isFile(territory, report),
      inside: insideOf(territory),
      files: territory.files,
      changed: formatAgo(territory.lastChangedAt, now),
      share: shareOfFiles(territory.files, totalFiles),
      sizeFraction: territory.files / biggest,
      truckFactor: territory.truckFactor,
      risk: riskOf(territory.truckFactor),
      experts: segments.slice(0, EXPERTS_SHOWN),
      segments,
      unclaimed: Math.max(0, territory.files - claimed),
      moreExperts: Math.max(0, segments.length - EXPERTS_SHOWN),
      lineOwners:
        territory.lineOwners === undefined
          ? null
          : territory.lineOwners.owners
              .slice(0, EXPERTS_SHOWN)
              .map(({ name, share, kind }) => ({
                name,
                share: formatPercent(share),
                kind,
              })),
      badges: territoryBadges(
        solo
          ? territory.badges.filter(({ kind }) => SOLO_BADGES.has(kind))
          : territory.badges,
      ),
    };
  });
};
