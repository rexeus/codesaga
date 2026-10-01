// Owns how many terminal columns a piece of text occupies.

const GRAPHEME_SEGMENTER = new Intl.Segmenter(undefined, {
  granularity: "grapheme",
});

/** Marks, format characters (joiners, variation selectors) and conjoining Hangul vowels and finals. */
const ZERO_WIDTH = /[\p{Mn}\p{Me}\p{Cf}\u1160-\u11FF]/u;

/** Emoji drawn as one wide glyph: default emoji presentation, an explicit VS16, or a flag. */
const EMOJI_GLYPH = /[\p{Emoji_Presentation}\p{Regional_Indicator}\uFE0F]/u;

/** East Asian Wide and Fullwidth blocks that are not emoji. */
const WIDE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x1100, 0x115f],
  [0x2e80, 0x303e],
  [0x3041, 0x33ff],
  [0x3400, 0x4dbf],
  [0x4e00, 0x9fff],
  [0xa000, 0xa4cf],
  [0xa960, 0xa97f],
  [0xac00, 0xd7a3],
  [0xf900, 0xfaff],
  [0xfe10, 0xfe19],
  [0xfe30, 0xfe6f],
  [0xff01, 0xff60],
  [0xffe0, 0xffe6],
  [0x20000, 0x2fffd],
  [0x30000, 0x3fffd],
];

const codePointWidth = (character: string): number => {
  const codePoint = character.codePointAt(0) ?? 0;
  if (ZERO_WIDTH.test(character)) {
    return 0;
  }
  return WIDE_RANGES.some(([from, to]) => codePoint >= from && codePoint <= to)
    ? 2
    : 1;
};

/**
 * The terminal columns `cluster` (one grapheme cluster) occupies: an emoji
 * sequence is one wide glyph, a combining mark adds nothing.
 */
export const columnWidth = (cluster: string): number =>
  EMOJI_GLYPH.test(cluster)
    ? 2
    : Array.from(cluster).reduce(
        (columns, character) => columns + codePointWidth(character),
        0,
      );

/**
 * `text` split into grapheme clusters, so a cut between them never separates
 * a base character from its combining marks or splits a joined emoji.
 */
export const graphemeClusters = (text: string): ReadonlyArray<string> =>
  Array.from(GRAPHEME_SEGMENTER.segment(text), ({ segment }) => segment);
