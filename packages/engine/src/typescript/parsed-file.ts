// Owns the parsed files the deep dive aggregates: a file's facts with the lines the universe measured for it.

import type { FileFacts } from "./file-facts.js";
import type { TypeScriptFacts } from "./gather-typescript.js";

/** A file the parser turned into facts. */
export type ParsedFile = {
  readonly path: string;
  /** Non-blank lines, as the universe measured them. */
  readonly lines: number;
  readonly facts: FileFacts;
};

/** The files of the verdicts that were parsed, in their order. */
export const parsedFilesOf = (
  files: TypeScriptFacts["files"],
): ReadonlyArray<ParsedFile> =>
  files.flatMap(({ path, lines, result }) =>
    result.kind === "parsed" ? [{ path, lines, facts: result.facts }] : [],
  );
