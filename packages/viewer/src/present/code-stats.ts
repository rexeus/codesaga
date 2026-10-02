import type { Report } from "@codesaga/engine";

import { formatCount, formatPercent } from "./format.js";

/** The code stats of the repository or of one territory. */
export type CodeStats = Report["stats"];

/** A count that interpolation may have left fractional, to the nearest whole with separators: `121`, `1,200`. */
export const formatWhole = (value: number): string =>
  formatCount(Math.round(value));

/** Levels per line with two decimals: `2.04`. */
export const formatLevels = (value: number): string => value.toFixed(2);

/** A share of a whole as a percent, `<1%` for a small non-zero share and `0%` for none. */
export const formatShare = (part: number, whole: number): string => {
  const share = part / Math.max(1, whole);
  return part > 0 && share < 0.005 ? "<1%" : formatPercent(share);
};

const TAIL_STEPS = 2;

/** The last two steps of a path, which tell a file apart without the whole path: `github/context.ts`. */
export const pathTail = (path: string): string =>
  path.split("/").slice(-TAIL_STEPS).join("/");

/** How the lines of a set of files are indented, in one phrase and the split behind it. */
export type Indentation = {
  /** `2 spaces`, `Tabs`, or `No indented lines`. */
  readonly headline: string;
  /** The spaces and tabs shares as whole percents: `100% spaces, 0% tabs`; empty without indented lines. */
  readonly split: string;
  readonly spacesShare: number;
  readonly tabsShare: number;
};

const spacesPhrase = (width: number): string =>
  width === 0 ? "Spaces" : `${width} spaces`;

/** The way of indenting that stats.style.indent describes. */
export const indentationOf = ({
  spacesShare,
  tabsShare,
  width,
}: CodeStats["style"]["indent"]): Indentation => {
  if (spacesShare === 0 && tabsShare === 0) {
    return { headline: "No indented lines", split: "", spacesShare, tabsShare };
  }
  return {
    headline: tabsShare > spacesShare ? "Tabs" : spacesPhrase(width),
    split: `${formatPercent(spacesShare)} spaces, ${formatPercent(tabsShare)} tabs`,
    spacesShare,
    tabsShare,
  };
};

/** Where two figures end on one shared bar, as fractions of its length. */
export type Comparison = {
  readonly value: number;
  readonly reference: number;
};

const HEADROOM = 1.12;

/**
 * The positions of `value` and of the `reference` it is held against on one
 * bar that both fit on, with a little room to the right. A zero scale puts
 * both at the start.
 */
export const compareOnBar = (value: number, reference: number): Comparison => {
  const scale = Math.max(value, reference) * HEADROOM;
  return scale === 0
    ? { value: 0, reference: 0 }
    : { value: value / scale, reference: reference / scale };
};

const RANGE_EDGE = 0.04;

/**
 * Where the median lies between the shortest and the longest file on a
 * logarithmic line, kept 4% clear of both ends so its dot stays inside the
 * track; a set of equal lengths puts it in the middle.
 */
export const rangePosition = (
  min: number,
  median: number,
  max: number,
): number => {
  const low = Math.log(Math.max(1, min));
  const high = Math.log(Math.max(1, max));
  if (high <= low) {
    return 0.5;
  }
  const at = (Math.log(Math.max(1, median)) - low) / (high - low);
  return Math.min(1 - RANGE_EDGE, Math.max(RANGE_EDGE, at));
};
