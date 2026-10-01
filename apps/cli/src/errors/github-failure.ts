// Owns the wording and exit codes of the failures of `--github`.
import type { GithubError } from "@codesaga/engine";

import { UNEXPECTED, USAGE } from "./failure.js";
import type { Failure } from "./failure.js";

/** Whether `error` is one of the engine's GitHub failures. */
export const isGithubError = (error: {
  readonly _tag: string;
}): error is GithubError =>
  error._tag === "GithubTokenMissing" ||
  error._tag === "GithubHostUnconfirmed" ||
  error._tag === "NotAGithubRemote" ||
  error._tag === "GithubRateLimited" ||
  error._tag === "GithubRequestFailed";

const tokenHint = (host: string): string =>
  host === "github.com"
    ? "set GH_TOKEN or GITHUB_TOKEN, or run `gh auth login`"
    : `set GH_ENTERPRISE_TOKEN or GITHUB_ENTERPRISE_TOKEN, or run \`gh auth login --hostname ${host}\``;

/**
 * Words a GitHub failure. A missing token, an unconfirmed host or a missing remote is a usage error (2): the
 * user can fix it by flag or setup. A rate limit or a failed request ends
 * with 1, naming when to try again where GitHub said so.
 */
export const githubFailure = (error: GithubError): Failure => {
  if (error._tag === "GithubTokenMissing") {
    return {
      message: `--github needs a GitHub token for ${error.host}: ${tokenHint(error.host)}`,
      exitCode: USAGE,
    };
  }
  if (error._tag === "GithubHostUnconfirmed") {
    return {
      message: `origin points to ${error.host}; set GH_HOST=${error.host} to use GitHub Enterprise there`,
      exitCode: USAGE,
    };
  }
  if (error._tag === "NotAGithubRemote") {
    return {
      message:
        error.remote === null
          ? '--github needs a GitHub repository, but this one has no "origin" remote'
          : `--github needs a GitHub repository, but "origin" is ${error.remote}`,
      exitCode: USAGE,
    };
  }
  if (error._tag === "GithubRateLimited") {
    return {
      message:
        error.resetAt === null
          ? "GitHub rate limit reached: try again later"
          : `GitHub rate limit reached: try again after ${error.resetAt}`,
      exitCode: UNEXPECTED,
    };
  }
  return {
    message:
      error.status === null
        ? `GitHub request failed: ${error.message}`
        : `GitHub request failed (${error.status}): ${error.message}`,
    exitCode: UNEXPECTED,
  };
};
