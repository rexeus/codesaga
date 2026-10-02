const SLOTS = 7;
const INITIALS = 2;

/** One or two capital letters standing for a name: `Lina Tawfik → "LT"`, `lina → "LI"`, nothing usable → `"?"`. */
export const initialsOf = (name: string): string => {
  const words = name.match(/[\p{L}\p{N}]+/gu) ?? [];
  const [first] = words;
  if (first === undefined) {
    return "?";
  }
  const last = words.at(-1) ?? first;
  const letters =
    words.length === 1
      ? Array.from(first).slice(0, INITIALS)
      : [Array.from(first)[0], Array.from(last)[0]];
  return letters.join("").toUpperCase();
};

/**
 * The categorical slot (1 to 7) of a person, fixed by their email so a person
 * keeps their color in every card and chart.
 */
export const slotOf = (email: string): number => {
  let hash = 0;
  for (const character of email) {
    hash = (hash * 31 + (character.codePointAt(0) ?? 0)) % 1_000_003;
  }
  return (hash % SLOTS) + 1;
};
