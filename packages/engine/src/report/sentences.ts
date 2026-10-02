// Owns the number and plural formatting of the report's sentences, so highlights and badges word counts alike.
// Fixed to en-US: the report's text does not depend on the machine's locale.

/** `4120` as "4,120". */
export const countOf = (value: number): string => value.toLocaleString("en-US");

/** "1 file", "3 files"; `plural` is the form for any other count. */
export const nounOf = (
  value: number,
  singular: string,
  plural = `${singular}s`,
) => `${countOf(value)} ${value === 1 ? singular : plural}`;

/** A share from 0 to 1 as a whole percent, "27%". */
export const percentOf = (share: number): string =>
  `${Math.round(share * 100)}%`;
