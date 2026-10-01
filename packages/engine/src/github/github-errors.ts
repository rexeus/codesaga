// Owns the failures of reading from GitHub; the CLI maps each tag to an exit code.
// Messages carry host names and statuses, never the token.
import { Schema } from "effect";

/** No token for `host` in the environment or in the `gh` CLI. */
export class GithubTokenMissing extends Schema.TaggedError<GithubTokenMissing>()(
  "GithubTokenMissing",
  { host: Schema.String },
) {}

/**
 * The `origin` remote is missing or does not name a GitHub repository.
 * `remote` is its URL without credentials, or null without an `origin`.
 */
export class NotAGithubRemote extends Schema.TaggedError<NotAGithubRemote>()(
  "NotAGithubRemote",
  { remote: Schema.NullOr(Schema.String) },
) {}

/** GitHub refused further requests until `resetAt` (ISO 8601), or for an unknown time. */
export class GithubRateLimited extends Schema.TaggedError<GithubRateLimited>()(
  "GithubRateLimited",
  { resetAt: Schema.NullOr(Schema.String) },
) {}

/**
 * GitHub did not answer with pull requests: an unreachable host (`status` is
 * null), a rejected token, missing permissions, or an unreadable response.
 */
export class GithubRequestFailed extends Schema.TaggedError<GithubRequestFailed>()(
  "GithubRequestFailed",
  { status: Schema.NullOr(Schema.Int), message: Schema.String },
) {}

export type GithubError =
  | GithubTokenMissing
  | NotAGithubRemote
  | GithubRateLimited
  | GithubRequestFailed;
