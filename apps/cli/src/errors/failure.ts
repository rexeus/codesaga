// Owns what ends the process: a worded failure and the exit codes it can carry.

/** A message for stderr, before escaping, and the exit code to end with. */
export type Failure = {
  readonly message: string;
  readonly exitCode: number;
  /** The result already went to stdout, so the failure adds only the message on stderr. */
  readonly resultPrinted?: boolean;
};

export const UNEXPECTED = 1;
export const USAGE = 2;
export const NOT_A_REPOSITORY = 3;
export const NOTHING_MATCHED = 4;
export const GATES_FAILED = 5;
