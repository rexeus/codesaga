// Owns what reading a repository from GitHub needs: where its API is and the token that opens it.
// The token is never printed: it stays `Redacted` until it becomes a request header.
import { Config, Effect, Option, Redacted, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

import type { GitError } from "../git/git-errors.js";
import { Git } from "../git/git.js";
import { GithubHostUnconfirmed, GithubTokenMissing } from "./github-errors.js";
import type { NotAGithubRemote } from "./github-errors.js";
import { DOTCOM, readOrigin } from "./remote.js";
import type { GithubRepository } from "./remote.js";

/** A GitHub repository with the endpoint and token to query it. */
export type GithubSource = {
  readonly host: string;
  /** `owner/name`. */
  readonly repository: string;
  /** The GraphQL endpoint of the host. */
  readonly endpoint: string;
  readonly token: Redacted.Redacted;
};

const DATA_RESIDENCY_SUFFIX = ".ghe.com";

/** The variables `gh` itself reads for a host; a github.com token is never sent to another host. */
const tokenVariables = (host: string): ReadonlyArray<string> =>
  host === DOTCOM
    ? ["GH_TOKEN", "GITHUB_TOKEN"]
    : ["GH_ENTERPRISE_TOKEN", "GITHUB_ENTERPRISE_TOKEN"];

/** The GraphQL endpoint: always https, on the remote's port when it had an http(s) one. */
const endpointOf = ({ host, port }: GithubRepository): string => {
  if (host === DOTCOM) {
    return "https://api.github.com/graphql";
  }
  if (host.endsWith(DATA_RESIDENCY_SUFFIX)) {
    return `https://api.${host}/graphql`;
  }
  return `https://${host}${port === null ? "" : `:${port}`}/api/graphql`;
};

const fromEnvironment = (
  name: string,
): Effect.Effect<Option.Option<Redacted.Redacted>> =>
  Config.Redacted(name).pipe(
    Config.option,
    Effect.orElseSucceed(() => Option.none<Redacted.Redacted>()),
    Effect.map(Option.filter((token) => Redacted.value(token).trim() !== "")),
  );

/** The token `gh auth token` prints for the host; none when `gh` is absent, not logged in, or fails. */
const fromGhCli = (
  host: string,
): Effect.Effect<
  Option.Option<Redacted.Redacted>,
  never,
  ChildProcessSpawner.ChildProcessSpawner
> =>
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const handle = yield* spawner.spawn(
      ChildProcess.make("gh", ["auth", "token", "--hostname", host], {
        env: { GH_PROMPT_DISABLED: "1" },
        extendEnv: true,
        stdin: "ignore",
        stderr: "ignore",
      }),
    );
    const [output, exitCode] = yield* Effect.all(
      [Stream.mkString(Stream.decodeText(handle.stdout)), handle.exitCode],
      { concurrency: 2 },
    );
    const token = output.trim();
    return exitCode === 0 && token !== ""
      ? Option.some(Redacted.make(token))
      : Option.none();
  }).pipe(
    Effect.scoped,
    Effect.orElseSucceed(() => Option.none<Redacted.Redacted>()),
    // Node throws some spawn errors instead of emitting them, and the spawner reports a throw as a defect.
    Effect.catchDefect(() => Effect.succeed(Option.none<Redacted.Redacted>())),
  );

/**
 * A host other than github.com gets the token only when the user names it in
 * `GH_HOST`, as `gh` does: a cloned repository chooses its `origin`, so the
 * remote alone must not decide where a credential goes.
 */
const requireNamedHost = (
  host: string,
): Effect.Effect<void, GithubHostUnconfirmed> =>
  host === DOTCOM
    ? Effect.void
    : Config.String("GH_HOST").pipe(
        Effect.orElseSucceed(() => ""),
        Effect.filterOrFail(
          (named) => named.trim().toLowerCase() === host,
          () => new GithubHostUnconfirmed({ host }),
        ),
        Effect.asVoid,
      );

const resolveToken = (
  host: string,
): Effect.Effect<
  Redacted.Redacted,
  GithubTokenMissing,
  ChildProcessSpawner.ChildProcessSpawner
> =>
  Effect.gen(function* () {
    for (const name of tokenVariables(host)) {
      const token = yield* fromEnvironment(name);
      if (Option.isSome(token)) {
        return token.value;
      }
    }
    return yield* fromGhCli(host).pipe(
      Effect.flatMap(Effect.fromOption),
      Effect.mapError(() => new GithubTokenMissing({ host })),
    );
  });

/**
 * The GitHub repository `origin` of the repository at `root` names, with the
 * token for its host: `GH_TOKEN`, then `GITHUB_TOKEN`, then `gh auth token`
 * for github.com; `GH_ENTERPRISE_TOKEN`, `GITHUB_ENTERPRISE_TOKEN`, then
 * `gh auth token --hostname` for any other host, which must be named in
 * `GH_HOST`. Its API is then assumed at `https://<host>[:port]/api/graphql`
 * (the port is the remote's, when it is an http(s) one), or at
 * `https://api.<host>/graphql` for a `*.ghe.com` host.
 *
 * Fails with `NotAGithubRemote`, `GithubHostUnconfirmed` or
 * `GithubTokenMissing`, before any request is made.
 */
export const resolveGithubSource = (
  root: string,
): Effect.Effect<
  GithubSource,
  GithubTokenMissing | GithubHostUnconfirmed | NotAGithubRemote | GitError,
  ChildProcessSpawner.ChildProcessSpawner
> =>
  Effect.gen(function* () {
    const origin = yield* readOrigin;
    yield* requireNamedHost(origin.host);
    return {
      host: origin.host,
      repository: `${origin.owner}/${origin.name}`,
      endpoint: endpointOf(origin),
      token: yield* resolveToken(origin.host),
    };
  }).pipe(Effect.provide(Git.layer(root)));
