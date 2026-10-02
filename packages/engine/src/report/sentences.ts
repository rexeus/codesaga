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

/**
 * An area's path as a sentence names it: the path itself, or "the repository
 * root" for the area `"."`, capitalized at the start of a sentence.
 */
export const areaNameOf = (path: string, sentenceStart = false): string =>
  path !== "." ? path : `${sentenceStart ? "The" : "the"} repository root`;

/** A share from 0 to 1 as a whole percent, "27%". */
export const percentOf = (share: number): string =>
  `${Math.round(share * 100)}%`;

const MAX_SUBJECT_CHARACTERS = 72;

/** A commit subject in quotes, cut to 72 characters (grapheme clusters) with an ellipsis; empty without a subject. */
export const quotedSubject = (subject: string): string => {
  const characters = Array.from(
    new Intl.Segmenter().segment(subject),
    ({ segment }) => segment,
  );
  if (characters.length === 0) {
    return "";
  }
  const cut =
    characters.length > MAX_SUBJECT_CHARACTERS
      ? `${characters.slice(0, MAX_SUBJECT_CHARACTERS - 1).join("")}…`
      : subject;
  return `"${cut}"`;
};
