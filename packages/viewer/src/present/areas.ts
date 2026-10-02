import type { Report } from "@codesaga/engine";

import { areaBadges } from "./badges.js";
import type { BadgeRow } from "./badges.js";
import { formatAgo, formatCount, formatPercent } from "./format.js";
import { personEntities } from "./people.js";

type Areas = Report["knowledge"]["areas"];
type Level = Areas["levels"][number];
type Area = Level["areas"][number];

/** How many cards of a level are drawn before the reader asks for all. */
export const AREA_CARDS_SHOWN = 12;
const EXPERTS_SHOWN = 3;
const LOW_TRUCK_FACTOR = 2;
const DAYS_PER_MONTH = 30.4;

/** One expert of an area as a bar segment and a row. */
export type ExpertView = {
  readonly name: string;
  readonly entity: string;
  readonly active: boolean;
  /** The share of the area's files the person is an expert on: `45%`. */
  readonly share: string;
  /** The segment's weight in the bar. */
  readonly weight: number;
};

/** A line owner of an area, as `git blame` attributes the lines at HEAD. */
type OwnerView = {
  readonly name: string;
  readonly share: string;
  readonly kind: "human" | "agent" | "bot";
};

/** One area as a card: where it is, how big, how safe, who knows it, and its badges. */
export type AreaView = {
  readonly key: string;
  /** The path above the area with its trailing slash, dimmed: `packages/`. */
  readonly parent: string;
  /** The area's own name: `db/`, or `/ (root)` for the repository root. */
  readonly leaf: string;
  /** The small areas below `path`, grouped as "other files". */
  readonly loose: boolean;
  readonly files: number;
  /** When anyone last changed a file of the area: `5 weeks ago`. */
  readonly changed: string;
  /** The area's share of all universe files: `19%`. */
  readonly share: string;
  /** The share as a fraction of the biggest area of the level, for the solo card's size bar. */
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

const parentOf = (path: string): { parent: string; leaf: string } => {
  if (path === ".") {
    return { parent: "", leaf: "/ (root)" };
  }
  const steps = path.split("/");
  const leaf = `${steps.pop() ?? ""}/`;
  return { parent: steps.length === 0 ? "" : `${steps.join("/")}/`, leaf };
};

/** A share of the files as a whole percent, `<1%` rather than `0%` for a few files. */
const shareOfFiles = (files: number, total: number): string => {
  const share = files / Math.max(1, total);
  return files > 0 && share < 0.005 ? "<1%" : formatPercent(share);
};

const riskOf = (truckFactor: number): AreaView["risk"] => {
  if (truckFactor <= 1) {
    return "crit";
  }
  return truckFactor === LOW_TRUCK_FACTOR ? "warn" : "none";
};

/** A repository with a single contributor: every area has the same one expert, so expertise and its risks say nothing. */
export const isSolo = ({ overview }: Report): boolean =>
  overview.contributors.total === 1;

/** The achievements that still mean something when one person did everything. */
const SOLO_BADGES = new Set(["new", "in-focus", "quiet", "well-tested"]);

/**
 * The cards of `level` in the engine's order (riskiest first, loose files
 * last), sized against the report's files and dated against its day. A solo
 * repository keeps only the badges that do not rest on several people.
 */
export const areaViews = (level: Level, report: Report): AreaView[] => {
  const totalFiles = report.knowledge.files;
  const now = report.generatedAt;
  const solo = isSolo(report);
  const entityOf = personEntities(report.contributors);
  const biggest = Math.max(1, ...level.areas.map(({ files }) => files));
  return level.areas.map((area) => {
    const segments = area.experts.map(
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
      key: `${area.kind}:${area.path}`,
      ...parentOf(area.path),
      loose: area.kind === "rest",
      files: area.files,
      changed: formatAgo(area.lastChangedAt, now),
      share: shareOfFiles(area.files, totalFiles),
      sizeFraction: area.files / biggest,
      truckFactor: area.truckFactor,
      risk: riskOf(area.truckFactor),
      experts: segments.slice(0, EXPERTS_SHOWN),
      segments,
      unclaimed: Math.max(0, area.files - claimed),
      moreExperts: Math.max(0, segments.length - EXPERTS_SHOWN),
      lineOwners:
        area.lineOwners === undefined
          ? null
          : area.lineOwners.owners
              .slice(0, EXPERTS_SHOWN)
              .map(({ name, share, kind }) => ({
                name,
                share: formatPercent(share),
                kind,
              })),
      badges: areaBadges(
        solo
          ? area.badges.filter(({ kind }) => SOLO_BADGES.has(kind))
          : area.badges,
      ),
    };
  });
};

/**
 * The areas of a level that stand for themselves, without the groups of loose
 * files. The engine's recommendation counts these, so the slider does too; a
 * level the output limit cut counts all its areas, since the cut-off ones
 * cannot be told apart.
 */
const namedAreas = (level: Level): number =>
  level.totalAreas > level.areas.length
    ? level.totalAreas
    : level.areas.filter(({ kind }) => kind !== "rest").length;

/** What the line above the cards counts: areas, covered files and the risky ones. */
export type LevelSummary = {
  readonly areas: number;
  /** The groups of loose files beside the areas. */
  readonly looseGroups: number;
  readonly coveredFiles: number;
  readonly totalFiles: number;
  readonly lowTruckFactor: number;
  readonly islands: number;
  readonly orphaned: number;
  /** A note when the report's output limit cut areas off; null otherwise. */
  readonly truncated: string | null;
};

const countWhere = (
  areas: readonly Area[],
  test: (area: Area) => boolean,
): number => areas.filter((area) => test(area)).length;

/** The summary of a level against the repository's `totalFiles`. */
export const levelSummary = (
  level: Level,
  totalFiles: number,
): LevelSummary => ({
  areas: namedAreas(level),
  looseGroups: countWhere(level.areas, ({ kind }) => kind === "rest"),
  coveredFiles: level.areas.reduce((sum, { files }) => sum + files, 0),
  totalFiles,
  lowTruckFactor: countWhere(
    level.areas,
    ({ truckFactor }) => truckFactor <= LOW_TRUCK_FACTOR,
  ),
  islands: countWhere(level.areas, ({ island }) => island),
  orphaned: countWhere(level.areas, ({ orphaned }) => orphaned),
  truncated:
    level.totalAreas > level.areas.length
      ? `Showing the ${formatCount(level.areas.length)} riskiest of ${formatCount(level.totalAreas)} areas: the report was limited.`
      : null,
});

/** One stop of the depth slider. */
export type DepthTick = {
  readonly depth: number;
  readonly label: string;
  readonly count: string;
  /** Where the stop lies along the track, 0 to 1. */
  readonly position: number;
  readonly recommended: boolean;
};

const areasPhrase = (count: number): string =>
  `${formatCount(count)} ${count === 1 ? "area" : "areas"}`;

/** The stops of the slider, one per level, spread evenly along the track. */
export const depthTicks = ({ levels, recommendedDepth }: Areas): DepthTick[] =>
  levels.map((level, index) => ({
    depth: level.depth,
    label: `Level ${level.depth}`,
    count: areasPhrase(namedAreas(level)),
    position: levels.length > 1 ? index / (levels.length - 1) : 0,
    recommended: level.depth === recommendedDepth,
  }));

const indexOfDepth = (areas: Areas, depth: number): number | null => {
  const index = areas.levels.findIndex((level) => level.depth === depth);
  return index < 0 ? null : index;
};

/** The level the reader starts at: the report's `depth`, else the recommended one, else the first. */
export const startLevel = (areas: Areas): number =>
  indexOfDepth(areas, areas.depth) ??
  indexOfDepth(areas, areas.recommendedDepth) ??
  0;

/** The level the "Jump to recommended" button selects. */
export const recommendedLevel = (areas: Areas): number =>
  indexOfDepth(areas, areas.recommendedDepth) ?? startLevel(areas);

/** The track's filled part from its start to level `index`, 0 to 1. */
export const sliderFill = ({ levels }: Areas, index: number): number =>
  levels.length > 1 ? index / (levels.length - 1) : 0;

/** The status line beside the slider: `11 non-overlapping areas`. */
export const levelStatus = (level: Level): string =>
  `${formatCount(namedAreas(level))} non-overlapping ${namedAreas(level) === 1 ? "area" : "areas"}`;

/**
 * The engine's reason ("level 2: 11 areas for 6 active contributors") as the
 * headline of the recommendation: `Level 2 · 11 areas for 6 active contributors`.
 */
export const recommendationHeadline = ({ reason }: Areas): string => {
  const sentence = reason.charAt(0).toUpperCase() + reason.slice(1);
  return sentence.replace(": ", " · ");
};

/** The legend entry for inactive experts: months from `thresholds.activeDays`. */
export const inactiveLegend = (activeDays: number): string =>
  `Inactive for ${Math.round(activeDays / DAYS_PER_MONTH)}+ months`;
