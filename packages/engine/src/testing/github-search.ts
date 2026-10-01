// Tests only: `searchPullRequests` against a scripted GitHub, for the tests of its results and of its failures.
import { Effect, Redacted } from "effect";

import { searchPullRequests } from "../github/pull-request-search.js";
import type { GithubSource } from "../github/source.js";
import { stubGithub } from "./stub-github.js";
import type { StubReply } from "./stub-github.js";

const source: GithubSource = {
  host: "github.com",
  repository: "acme/web",
  endpoint: "https://api.github.com/graphql",
  token: Redacted.make("s3cret-token"),
};

/**
 * Searches since 2026-02-01 against a client that answers request number
 * `index` (from 0) with `replies(index)`; `requests` fills as the search runs.
 */
export const search = (replies: (index: number) => StubReply) => {
  const stub = stubGithub((_, index) => replies(index));
  return {
    requests: stub.requests,
    run: searchPullRequests(source, "2026-02-01T00:00:00.000Z").pipe(
      Effect.provide(stub.layer),
    ),
  };
};
