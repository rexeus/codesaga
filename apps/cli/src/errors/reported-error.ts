// Owns how a failure ends the process: one terminal-safe line and an exit code.
import type { AnalyzeError, GithubError } from "@codesaga/engine";
import { Runtime, Schema } from "effect";
import { CliError } from "effect/cli";

import { escapeForTerminal } from "../output/escape.js";
import type { HtmlWriteFailed } from "../output/html/html-write-failed.js";
import type { ConfigInvalid } from "./config-invalid.js";
import {
  GATES_FAILED,
  NOT_A_REPOSITORY,
  NOTHING_MATCHED,
  UNEXPECTED,
  USAGE,
} from "./failure.js";
import type { Failure } from "./failure.js";
import type { GatesFailed } from "./gates-failed.js";
import { githubFailure, isGithubError } from "./github-failure.js";
import type { NoGatesConfigured } from "./no-gates-configured.js";
import { noFileMatches } from "./nothing-matched.js";
import type { NothingMatched } from "./nothing-matched.js";
import type { PathNotFound } from "./path-not-found.js";
import type { ShallowClone } from "./shallow-clone.js";

/**
 * A failure that is already worded for the user. Its message is escaped and
 * `[Runtime.errorReported]` is false: the runtime must not print a second
 * report, and `[Runtime.errorExitCode]` becomes the process exit code.
 */
export class CliReportedError extends Schema.TaggedError<CliReportedError>()(
  "CliReportedError",
  {
    message: Schema.String,
    exitCode: Schema.Int,
    /** The command printed a complete result to stdout before it failed; the run must keep it there. */
    resultPrinted: Schema.Boolean,
  },
) {
  override readonly [Runtime.errorExitCode] = this.exitCode;
  override readonly [Runtime.errorReported] = false;
}

/** Every expected failure a command can end with, except a help request. */
export type KnownFailure =
  | AnalyzeError
  | NothingMatched
  | PathNotFound
  | ConfigInvalid
  | NoGatesConfigured
  | ShallowClone
  | GatesFailed
  | HtmlWriteFailed
  | GithubError
  | CliError.CliError;

const cliFailure = (error: CliError.CliError): Failure => {
  if (error._tag === "ShowHelp") {
    return {
      message: error.errors.map((cause) => cause.message).join("; "),
      exitCode: USAGE,
    };
  }
  return {
    message: error.message,
    exitCode: error._tag === "UserError" ? UNEXPECTED : USAGE,
  };
};

const invalidWindowMessage = (
  error: Extract<AnalyzeError, { _tag: "InvalidSince" | "InvalidCompare" }>,
): string => {
  if (error._tag === "InvalidSince") {
    return `invalid --since "${error.input}": use <n>d, <n>w, <n>m, <n>y or YYYY-MM-DD`;
  }
  return error.reason === "withSince"
    ? "--compare cannot be combined with --since: it sets the window itself"
    : `invalid --compare "${error.input}": use <n>d, <n>w, <n>m or <n>y`;
};

const checkFailure = (
  error: NoGatesConfigured | ShallowClone | GatesFailed,
): Failure => {
  if (error._tag === "NoGatesConfigured") {
    return {
      message:
        'no gates configured: pass a gate flag such as --min-truck-factor, or set "gates" in .codesaga.json',
      exitCode: USAGE,
    };
  }
  if (error._tag === "ShallowClone") {
    return {
      message:
        "check needs the full history: this is a shallow clone (run git fetch --unshallow, or use fetch-depth: 0 in actions/checkout)",
      exitCode: USAGE,
    };
  }
  return {
    message: `${error.failed} of ${error.total} ${error.total === 1 ? "gate" : "gates"} failed`,
    exitCode: GATES_FAILED,
    resultPrinted: true,
  };
};

const engineFailure = (
  error:
    | AnalyzeError
    | NothingMatched
    | PathNotFound
    | ConfigInvalid
    | HtmlWriteFailed
    | GithubError,
): Failure => {
  if (isGithubError(error)) {
    return githubFailure(error);
  }
  if (error._tag === "InvalidSince" || error._tag === "InvalidCompare") {
    return { message: invalidWindowMessage(error), exitCode: USAGE };
  }
  if (error._tag === "PathNotFound") {
    return {
      message: `no such file or directory: ${error.path}`,
      exitCode: USAGE,
    };
  }
  if (error._tag === "ConfigInvalid") {
    return {
      message: `invalid ${error.file}: ${error.problems.join("; ")}`,
      exitCode: USAGE,
    };
  }
  if (error._tag === "NotAGitRepository") {
    return {
      message: `not a git repository: ${error.path}`,
      exitCode: NOT_A_REPOSITORY,
    };
  }
  if (error._tag === "GitNotFound") {
    return {
      message: "git was not found on PATH; codesaga needs git",
      exitCode: NOT_A_REPOSITORY,
    };
  }
  if (error._tag === "HtmlWriteFailed") {
    return {
      message: `cannot write ${error.path}: ${error.reason}`,
      exitCode: UNEXPECTED,
    };
  }
  if (error._tag === "NothingMatched") {
    return {
      message: noFileMatches(error.patterns),
      exitCode: NOTHING_MATCHED,
    };
  }
  return {
    message: `git ${error.args.join(" ")} failed with exit code ${error.exitCode}: ${error.stderr.trim()}`,
    exitCode: UNEXPECTED,
  };
};

const describe = (error: KnownFailure): Failure => {
  if (CliError.isCliError(error)) {
    return cliFailure(error);
  }
  return error._tag === "NoGatesConfigured" ||
    error._tag === "ShallowClone" ||
    error._tag === "GatesFailed"
    ? checkFailure(error)
    : engineFailure(error);
};

const reported = ({
  message,
  exitCode,
  resultPrinted = false,
}: Failure): CliReportedError =>
  new CliReportedError({
    message: escapeForTerminal(message),
    exitCode,
    resultPrinted,
  });

/**
 * Words an expected failure and assigns its exit code: 2 for usage errors
 * (an invalid `--since` or `--compare`, a path that does not exist, an invalid
 * config file, `check` without gates or in a shallow clone, `--github` without
 * a token or a GitHub `origin`), 3 for no git repository or no git, 4 when
 * `inspect` matched nothing, 5 when a `check` gate failed, 1 for the rest.
 */
export const toReportedError = (error: KnownFailure): CliReportedError =>
  reported(describe(error));

/** Words a defect, a bug rather than a condition the user can fix, as exit code 1. */
export const toUnexpectedError = (defect: unknown): CliReportedError =>
  reported({
    message: `unexpected error: ${defect instanceof Error ? defect.message : String(defect)}`,
    exitCode: UNEXPECTED,
  });
