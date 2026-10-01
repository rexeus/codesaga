import { Schema } from "effect";

/** `check` evaluated its gates and at least one failed; the result is already printed. */
export class GatesFailed extends Schema.TaggedError<GatesFailed>()(
  "GatesFailed",
  { failed: Schema.Natural, total: Schema.Natural },
) {}
