// Owns the one string order the report's tie-breaks use: by UTF-16 code unit, which no locale or ICU version can change.
// `localeCompare` ranks "a" and "B" by the machine's rules, so two machines would list the same ties differently.

/** Negative when `left` sorts before `right`, positive after, 0 when equal; the order of `Array.prototype.sort` on strings. */
export const compareCodeUnits = (left: string, right: string): number =>
  Number(left > right) - Number(left < right);
