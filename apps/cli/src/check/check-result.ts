// Owns the versioned JSON document of `codesaga check`.
// Additive fields keep schemaVersion 1; renaming or removing a field bumps it.
import { Schema } from "effect";

/** One evaluated gate. */
const GateResult = Schema.Struct({
  name: Schema.Literals([
    "minTruckFactor",
    "maxOrphanedDirectories",
    "maxIslandDirectories",
    "maxAgentShare",
    "minActiveContributors",
  ]),
  /** The configured limit; for `maxAgentShare` a ratio from 0 to 1. */
  threshold: Schema.Finite,
  /** The measured value; `maxAgentShare` is rounded to 4 decimals before it is compared. */
  actual: Schema.Finite,
  passed: Schema.Boolean,
  /** One plain sentence that states the measurement against the limit, for passed and failed gates alike. */
  reason: Schema.String,
});

/**
 * The result of `check`: the configured gates in a fixed order. `passed` is
 * true when every gate passed.
 */
export const CheckResult = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  passed: Schema.Boolean,
  gates: Schema.Array(GateResult),
});
export type CheckResult = typeof CheckResult.Type;
