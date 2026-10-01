// Tests only: tagged errors as plain objects, because `deepStrictEqual` and `toStrictEqual` skip fields of an Error, among them the non-enumerable `message`.

/** `_tag`, every field and the `message` of `error`, for an assertion that must see all of them. */
export const fieldsOf = (error: Error): Record<string, unknown> => ({
  ...Object.fromEntries(Object.entries(error)),
  message: error.message,
});
