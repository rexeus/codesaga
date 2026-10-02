import { formatCount } from "./format.js";
import { namedTerritories } from "./territories.js";
import type { Detail, Territories } from "./territory-details.js";

/** One stop of the detail slider. */
export type DetailTick = {
  readonly detail: number;
  readonly label: string;
  readonly count: string;
  /** Where the stop lies along the track, 0 to 1. */
  readonly position: number;
  readonly recommended: boolean;
};

const territoriesPhrase = (count: number): string =>
  `${formatCount(count)} ${count === 1 ? "territory" : "territories"}`;

/** The stops of the slider, one per detail, spread evenly along the track. */
export const detailTicks = ({
  details,
  recommendedDetail,
}: Territories): DetailTick[] =>
  details.map((detail, index) => ({
    detail: detail.detail,
    label: `Detail ${detail.detail}`,
    count: territoriesPhrase(namedTerritories(detail)),
    position: details.length > 1 ? index / (details.length - 1) : 0,
    recommended: detail.detail === recommendedDetail,
  }));

const indexOfDetail = (
  territories: Territories,
  wanted: number,
): number | null => {
  const index = territories.details.findIndex(
    ({ detail }) => detail === wanted,
  );
  return index < 0 ? null : index;
};

/** The detail the reader starts at: the report's `detail`, else the recommended one, else the first. */
export const startDetail = (territories: Territories): number =>
  indexOfDetail(territories, territories.detail) ??
  indexOfDetail(territories, territories.recommendedDetail) ??
  0;

/** The detail the "Jump to recommended" button selects. */
export const recommendedDetailIndex = (territories: Territories): number =>
  indexOfDetail(territories, territories.recommendedDetail) ??
  startDetail(territories);

/** The track's filled part from its start to detail `index`, 0 to 1. */
export const sliderFill = ({ details }: Territories, index: number): number =>
  details.length > 1 ? index / (details.length - 1) : 0;

/** The status line beside the slider: `11 non-overlapping territories`. */
export const detailStatus = (detail: Detail): string =>
  `${formatCount(namedTerritories(detail))} non-overlapping ${namedTerritories(detail) === 1 ? "territory" : "territories"}`;

/**
 * The engine's reason ("detail 2: 11 territories for 6 active contributors") as the
 * headline of the recommendation: `Detail 2 · 11 territories for 6 active contributors`.
 */
export const recommendationHeadline = ({ reason }: Territories): string => {
  const sentence = reason.charAt(0).toUpperCase() + reason.slice(1);
  return sentence.replace(": ", " · ");
};
