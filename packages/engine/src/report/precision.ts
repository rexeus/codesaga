// Owns how many decimals the report's fractional values keep.

const FACTOR = 10 ** 4;

/**
 * Rounds a fractional report value (a share) to 4 decimals. Full float
 * precision costs tokens and carries no information. Round only what is
 * emitted; decisions use exact values.
 */
export const roundReported = (value: number): number =>
  Math.round(value * FACTOR) / FACTOR;
