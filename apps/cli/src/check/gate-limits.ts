// Owns the gates' names and limits: their shape in `.codesaga.json` and the merge of config and flags.
import { Option, Schema } from "effect";

/** The gates in the order `check` reports them. */
export const GATE_NAMES = [
  "minTruckFactor",
  "maxOrphanedDirectories",
  "maxIslandDirectories",
  "maxAgentShare",
  "minActiveContributors",
] as const;

export type GateName = (typeof GATE_NAMES)[number];

/** The `gates` object of `.codesaga.json`; a gate is checked only when its key is present. */
export const GateLimitsConfig = Schema.Struct({
  minTruckFactor: Schema.optionalKey(Schema.Natural),
  maxOrphanedDirectories: Schema.optionalKey(Schema.Natural),
  maxIslandDirectories: Schema.optionalKey(Schema.Natural),
  maxAgentShare: Schema.optionalKey(
    Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 })),
  ),
  minActiveContributors: Schema.optionalKey(Schema.Natural),
});

/** The limit of every gate; `undefined` means the gate is not configured. */
export type GateLimits = { readonly [Name in GateName]: number | undefined };

/** The limits the command line gave; `None` means "not given". */
export type GateFlags = { readonly [Name in GateName]: Option.Option<number> };

/** Merges config and flags gate by gate: a flag wins over the config's limit for the same gate. */
export const resolveGateLimits = (
  config: (typeof GateLimitsConfig)["Type"] | undefined,
  flags: GateFlags,
): GateLimits => ({
  minTruckFactor: Option.getOrElse(
    flags.minTruckFactor,
    () => config?.minTruckFactor,
  ),
  maxOrphanedDirectories: Option.getOrElse(
    flags.maxOrphanedDirectories,
    () => config?.maxOrphanedDirectories,
  ),
  maxIslandDirectories: Option.getOrElse(
    flags.maxIslandDirectories,
    () => config?.maxIslandDirectories,
  ),
  maxAgentShare: Option.getOrElse(
    flags.maxAgentShare,
    () => config?.maxAgentShare,
  ),
  minActiveContributors: Option.getOrElse(
    flags.minActiveContributors,
    () => config?.minActiveContributors,
  ),
});

/** Whether at least one gate is configured. */
export const hasGates = (limits: GateLimits): boolean =>
  GATE_NAMES.some((name) => limits[name] !== undefined);
