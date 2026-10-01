import { Schema } from "effect";

/** `check` ran in a shallow clone, whose missing history would let a gate pass or fail on wrong numbers. */
export class ShallowClone extends Schema.TaggedError<ShallowClone>()(
  "ShallowClone",
  {},
) {}
