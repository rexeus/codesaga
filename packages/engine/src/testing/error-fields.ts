// Tests only: tagged errors as plain objects, because `deepStrictEqual` compares an Error by name and message alone.

/** The own fields of `error`, `_tag` included, for an assertion that must see every field. */
export const fieldsOf = (error: object): Record<string, unknown> =>
  Object.fromEntries(Object.entries(error));
