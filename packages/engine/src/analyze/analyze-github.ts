// Owns the one entry point that adds GitHub's pull requests to a Report.
// `analyze` stays offline: nothing here runs unless a caller asks for it, and the type shows it by requiring an HttpClient.

import type { FileSystem, Path } from "effect";
import { Effect } from "effect";
import type { HttpClient } from "effect/http";
import type { ChildProcessSpawner } from "effect/process";

import { locateRepository } from "../git/repository.js";
import type { GithubError } from "../github/github-errors.js";
import { searchPullRequests } from "../github/pull-request-search.js";
import { resolveGithubSource } from "../github/source.js";
import { pullRequestsSection } from "../pull-requests/pull-requests.js";
import type { Report } from "../report/report.js";
import { analyze } from "./analyze.js";
import type { AnalyzeError, AnalyzeOptions } from "./gather.js";

/**
 * Like `analyze`, and the report gains a `pullRequests` section read from
 * GitHub for the activity window. The repository comes from the `origin`
 * remote and the token from `GH_TOKEN`, `GITHUB_TOKEN` or `gh auth token`
 * (see `resolveGithubSource`); the only request content is the repository
 * name and the token.
 *
 * The remote and the token are checked before git's history is read. Fails
 * with everything `analyze` does and with `NotAGithubRemote`,
 * `GithubTokenMissing`, `GithubRateLimited` and `GithubRequestFailed`.
 */
export const analyzeWithGithub = (
  options: AnalyzeOptions,
): Effect.Effect<
  Report,
  AnalyzeError | GithubError,
  | ChildProcessSpawner.ChildProcessSpawner
  | FileSystem.FileSystem
  | HttpClient.HttpClient
  | Path.Path
> =>
  Effect.gen(function* () {
    const source = yield* resolveGithubSource(
      yield* locateRepository(options.cwd),
    );
    const report = yield* analyze(options);
    const { pulls, truncated } = yield* searchPullRequests(
      source,
      report.window.since,
    );
    return {
      ...report,
      pullRequests: pullRequestsSection({
        host: source.host,
        repository: source.repository,
        pulls,
        truncated,
        window: report.window,
        months: report.activity.months.map(({ month }) => month),
      }),
    };
  });
