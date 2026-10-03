// Owns what `buildReport` reads: the repository's facts and, for `analyze`, the parse of its history's TypeScript.
import type { HistoryFacts } from "../typescript/history-facts.js";
import type { RepositoryFacts } from "./gather.js";

/** The facts, and the facts of every historical TypeScript and JavaScript blob, which only `analyze` gathers. */
export type ReportFacts = RepositoryFacts & {
  readonly historyFacts?: HistoryFacts | undefined;
};
