import type { Report } from "@codesaga/engine";

type Language = Report["overview"]["languages"][number];

/** A language (or the folded rest) with its share of the lines of code. */
export type LanguageShare = {
  readonly name: string;
  readonly files: number;
  readonly loc: number;
  /** Percent with one decimal; all shares of a list add up to exactly 100. */
  readonly percent: number;
  /** The entity class of its segment and legend swatch. */
  readonly entity: string;
};

const MAX_NAMED = 7;
const TENTHS = 1000;

/** The named languages, and everything beyond the seventh folded into "Other". */
const foldTail = (languages: readonly Language[]): Language[] => {
  if (languages.length <= MAX_NAMED) {
    return [...languages];
  }
  const tail = languages.slice(MAX_NAMED);
  return [
    ...languages.slice(0, MAX_NAMED),
    {
      name: "Other",
      files: tail.reduce((sum, { files }) => sum + files, 0),
      loc: tail.reduce((sum, { loc }) => sum + loc, 0),
    },
  ];
};

/**
 * Whole tenths of a percent per value, rounded by the largest remainder so
 * that they add up to exactly 1000 (100.0%).
 */
const tenthsOfPercent = (values: readonly number[]): number[] => {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total === 0) {
    return values.map(() => 0);
  }
  const exact = values.map((value) => (value / total) * TENTHS);
  const tenths = exact.map((value) => Math.floor(value));
  const missing = TENTHS - tenths.reduce((sum, value) => sum + value, 0);
  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .toSorted((left, right) => right.remainder - left.remainder);
  for (const { index } of byRemainder.slice(0, missing)) {
    tenths[index] = (tenths[index] ?? 0) + 1;
  }
  return tenths;
};

/**
 * Lines of code per language as shares, most lines first. Beyond seven
 * languages the tail folds into "Other": the palette has no more hues.
 */
export const languageShares = (
  languages: readonly Language[],
): LanguageShare[] => {
  const folded = foldTail(languages);
  const tenths = tenthsOfPercent(folded.map(({ loc }) => loc));
  return folded.map(({ name, files, loc }, index) => ({
    name,
    files,
    loc,
    percent: (tenths[index] ?? 0) / 10,
    entity:
      languages.length > MAX_NAMED && index === MAX_NAMED
        ? "slot-other"
        : `slot-${index + 1}`,
  }));
};
