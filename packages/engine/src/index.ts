export { analyze } from "./analyze/analyze.js";
export { aiShareOf } from "./automation/automation.js";
export { analyzeWithGithub } from "./analyze/analyze-github.js";
export type { AnalyzeError, AnalyzeOptions } from "./analyze/gather.js";
export type { GithubError } from "./github/github-errors.js";
export { locateRepository } from "./git/repository.js";
export { inspect } from "./inspect/inspect.js";
export { InspectResult } from "./report/inspect-result.js";
export { Report } from "./report/report.js";
export { isFileDigest } from "./typescript/digest/file-digest.js";
export { digestOfSource, factsOfSource } from "./typescript/facts-of-source.js";
export { isFileFacts } from "./typescript/file-facts.js";
export { ParseProgress } from "./typescript/parse-progress.js";
export type { FactsResult, SourceText } from "./typescript/facts-of-source.js";
export {
  TypeScriptParser,
  unavailableParser,
} from "./typescript/typescript-parser.js";
