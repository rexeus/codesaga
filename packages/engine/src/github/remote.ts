// Owns reading the repository's `origin` remote and recognizing a GitHub repository in it.
import { Effect } from "effect";

import type { GitCommandFailed, GitError } from "../git/git-errors.js";
import { Git } from "../git/git.js";
import { NotAGithubRemote } from "./github-errors.js";

/** A repository on a GitHub host, as the `origin` remote names it. */
export type GithubRepository = {
  /** Lowercase host name: `github.com` or a GitHub Enterprise host. */
  readonly host: string;
  readonly owner: string;
  readonly name: string;
};

const NAME = String.raw`[\w.-]+`;
// `https://[user[:password]@]host[:port]/owner/name[.git]` and the ssh and git URL forms.
const URL_FORM = new RegExp(
  String.raw`^(?:https?|ssh|git|git\+ssh|ssh\+git)://(?:[^@/]*@)?([^/:@]+)(?::\d+)?/(${NAME})/(${NAME}?)(?:\.git)?/?$`,
  "u",
);
// `[user@]host:owner/name[.git]`, the form git prints for ssh remotes.
const SCP_FORM = new RegExp(
  String.raw`^(?:[^@/:]+@)?([^/:@]+):(${NAME})/(${NAME}?)(?:\.git)?/?$`,
  "u",
);

/**
 * The repository an `origin` URL names, or undefined for a URL that is not
 * `owner/name` on some host: a local path, a `file:` URL, a deeper path.
 */
const parseRemoteUrl = (url: string): GithubRepository | undefined => {
  const match = URL_FORM.exec(url) ?? SCP_FORM.exec(url);
  const [, host, owner, name] = match ?? [];
  return host === undefined ||
    owner === undefined ||
    name === undefined ||
    name === "." ||
    name === ".."
    ? undefined
    : { host: host.toLowerCase(), owner, name };
};

/** The URL with any `user:password@` removed, safe to print. */
const withoutCredentials = (url: string): string =>
  url.replace(/^([a-z+]+:\/\/)[^@/]*@/iu, "$1");

/**
 * The repository named by `origin` of the repository `git` runs in.
 *
 * Fails with `NotAGithubRemote` without an `origin` or when its URL is not
 * `owner/name` on a host.
 */
export const readOrigin: Effect.Effect<
  GithubRepository,
  NotAGithubRemote | GitError,
  Git
> = Effect.gen(function* () {
  const git = yield* Git;
  const url = yield* git.text(["remote", "get-url", "origin"]).pipe(
    Effect.map((output) => output.trim()),
    Effect.catchTag(
      "GitCommandFailed",
      (failure): Effect.Effect<never, NotAGithubRemote | GitCommandFailed> =>
        Effect.fail(
          failure.stderr.includes("No such remote")
            ? new NotAGithubRemote({ remote: null })
            : failure,
        ),
    ),
  );
  const repository = parseRemoteUrl(url);
  return repository === undefined
    ? yield* new NotAGithubRemote({ remote: withoutCredentials(url) })
    : repository;
});
