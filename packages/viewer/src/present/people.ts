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

/** The contributors who get a color of their own; everyone further down shares the neutral one. */
const COLORED_PEOPLE = 7;

/**
 * The entity class (`slot-1` to `slot-7`, else `slot-other`) of a person by
 * email. The first seven contributors of the report, in its order, get a
 * categorical slot each, so a person keeps one color in every card and bar of
 * the page; no one else is told apart by color.
 */
export const personEntities = (
  contributors: readonly { readonly email: string }[],
): ((email: string) => string) => {
  const slots = new Map(
    contributors
      .slice(0, COLORED_PEOPLE)
      .map(({ email }, index) => [email, `slot-${index + 1}`]),
  );
  return (email) => slots.get(email) ?? "slot-other";
};
