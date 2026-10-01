import { Schema } from "effect";

/** `check` has no gate to evaluate: no gate flag was given and `.codesaga.json` sets no `gates`. */
export class NoGatesConfigured extends Schema.TaggedError<NoGatesConfigured>()(
  "NoGatesConfigured",
  {},
) {}
