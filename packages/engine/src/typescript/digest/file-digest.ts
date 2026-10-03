// Owns the digest of one file version: the few counts the history keeps for every version of every file.
// `FileFacts` describes the files at HEAD in full and costs about 2 KB a file in a cache; the history needs far less to replay, so it keeps this projection of what the trends and the craft badges read.

/**
 * The version of `FileDigest`. A cache holds digests under their version, so
 * it rises with every change to what a digest means or contains.
 */
export const FILE_DIGEST_VERSION = 1;

/** A function of 3 or more as the history follows it: its name within the file and its cognitive complexity. */
type DigestFunction = readonly [name: string, complexity: number];

/** What the history reads of one file version. Every count is additive across files. */
export type FileDigest = {
  readonly version: typeof FILE_DIGEST_VERSION;
  /** Non-blank lines, as the universe counts them. */
  readonly lines: number;
  /** Explicit `any` keywords. */
  readonly any: number;
  /** Escape sites, as `typeSafety` counts them. */
  readonly escapes: number;
  /** `@ts-` directives and lint disables. */
  readonly suppressions: number;
  readonly functions: number;
  /** Functions of cognitive complexity 15 or more. */
  readonly complexFunctions: number;
  /** The functions of 3 or more, hardest first, at most 40 (`MAX_NOTABLE_PER_FILE`): a list of 40 may be cut. */
  readonly notable: ReadonlyArray<DigestFunction>;
  /** Whether the file uses ES module syntax, and whether it uses CommonJS. */
  readonly esm: boolean;
  readonly commonjs: boolean;
  readonly testCases: number;
  readonly focusedTests: number;
  /** Top-level classes, functions and arrow-function constants, exported or not. */
  readonly declarations: number;
  /** The part of them that are functions or arrow-function constants. */
  readonly topLevelFunctions: number;
  /** Exported declarations, as `markers` counts them. */
  readonly exportedDeclarations: number;
};

const NUMBER_FIELDS = [
  "lines",
  "any",
  "escapes",
  "suppressions",
  "functions",
  "complexFunctions",
  "testCases",
  "focusedTests",
  "declarations",
  "topLevelFunctions",
  "exportedDeclarations",
] as const;

/** Whether a value read from a cache or a child process is a digest of the current version. */
export const isFileDigest = (value: unknown): value is FileDigest =>
  typeof value === "object" &&
  value !== null &&
  "version" in value &&
  value.version === FILE_DIGEST_VERSION &&
  NUMBER_FIELDS.every(
    (field) => typeof Reflect.get(value, field) === "number",
  ) &&
  Array.isArray(Reflect.get(value, "notable")) &&
  typeof Reflect.get(value, "esm") === "boolean" &&
  typeof Reflect.get(value, "commonjs") === "boolean";
