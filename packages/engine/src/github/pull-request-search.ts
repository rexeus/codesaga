// Owns searching a repository's pull requests through GitHub's GraphQL search.
// Two searches, pull requests created and pull requests closed since a date, are merged by number and capped.
import { Effect, Schema } from "effect";
import type { HttpClient } from "effect/http";

import type { PullRequestRecord } from "../pull-requests/pull-requests.js";
import type {
  GithubRateLimited,
  GithubRequestFailed,
} from "./github-errors.js";
import { graphql } from "./graphql.js";
import type { GithubSource } from "./source.js";

/** Pull requests fetched at most; GitHub's search returns no more than 1,000 per query anyway. */
const MAX_PULL_REQUESTS = 1000;
const PAGE_SIZE = 100;
const MAX_REVIEWS = 100;

const QUERY = `query($q: String!, $cursor: String) {
  search(query: $q, type: ISSUE, first: ${PAGE_SIZE}, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes {
      ... on PullRequest {
        number createdAt mergedAt closedAt
        author { kind: __typename login }
        reviews(first: ${MAX_REVIEWS}) {
          nodes { state submittedAt author { kind: __typename login } }
        }
      }
    }
  }
}`;

const Actor = Schema.NullOr(
  Schema.Struct({ kind: Schema.String, login: Schema.String }),
);

const PullRequestNode = Schema.Struct({
  number: Schema.Int,
  createdAt: Schema.String,
  mergedAt: Schema.NullOr(Schema.String),
  closedAt: Schema.NullOr(Schema.String),
  author: Actor,
  reviews: Schema.Struct({
    nodes: Schema.Array(
      Schema.NullOr(
        Schema.Struct({
          state: Schema.String,
          submittedAt: Schema.NullOr(Schema.String),
          author: Actor,
        }),
      ),
    ),
  }),
});

const SearchData = Schema.Struct({
  search: Schema.Struct({
    pageInfo: Schema.Struct({
      hasNextPage: Schema.Boolean,
      endCursor: Schema.NullOr(Schema.String),
    }),
    nodes: Schema.Array(Schema.NullOr(PullRequestNode)),
  }),
});

type Node = typeof PullRequestNode.Type;
type Page = typeof SearchData.Type.search;

/** The login as the report names it: a bot carries `[bot]`, a deleted account is `ghost`. */
const loginOf = (actor: typeof Actor.Type): string => {
  if (actor === null) {
    return "ghost";
  }
  return actor.kind === "Bot" ? `${actor.login}[bot]` : actor.login;
};

const recordOf = (node: Node): PullRequestRecord => ({
  number: node.number,
  author: loginOf(node.author),
  createdAt: node.createdAt,
  mergedAt: node.mergedAt,
  closedAt: node.closedAt,
  reviews: node.reviews.nodes.flatMap((review) =>
    review === null || review.submittedAt === null
      ? []
      : [
          {
            author: loginOf(review.author),
            state: review.state,
            submittedAt: review.submittedAt,
          },
        ],
  ),
});

/** The pull requests found so far by number, and whether more matched than were kept. */
type Found = {
  readonly pulls: ReadonlyMap<number, PullRequestRecord>;
  readonly truncated: boolean;
};

/** Adds a page's pull requests until the cap; one more new pull request than fits marks the result truncated. */
const absorb = (found: Found, nodes: Page["nodes"]): Found => {
  const pulls = new Map(found.pulls);
  let truncated = found.truncated;
  for (const node of nodes) {
    if (node === null || pulls.has(node.number)) {
      continue;
    }
    if (pulls.size >= MAX_PULL_REQUESTS) {
      truncated = true;
      break;
    }
    pulls.set(node.number, recordOf(node));
  }
  return { pulls, truncated };
};

type Failure = GithubRateLimited | GithubRequestFailed;

const collect = (
  source: GithubSource,
  search: string,
  found: Found,
  cursor: string | null,
): Effect.Effect<Found, Failure, HttpClient.HttpClient> =>
  graphql(
    { url: source.endpoint, token: source.token },
    QUERY,
    { q: search, cursor },
    SearchData,
  ).pipe(
    Effect.flatMap(({ search: page }) => {
      const next = absorb(found, page.nodes);
      const { hasNextPage, endCursor } = page.pageInfo;
      if (!hasNextPage || next.truncated) {
        return Effect.succeed(next);
      }
      return next.pulls.size >= MAX_PULL_REQUESTS
        ? Effect.succeed({ ...next, truncated: true })
        : collect(source, search, next, endCursor);
    }),
  );

/** GitHub accepts a date-time to the second. */
const toSearchTime = (iso: string): string => iso.replace(/\.\d+Z$/u, "Z");

/**
 * Searches the repository's pull requests created, and those closed (merged or
 * not), since `since` (ISO 8601), merged by number, newest activity first,
 * 100 per request. Stops at 1,000 pull requests and says so in `truncated`.
 *
 * Fails with `GithubRateLimited` and `GithubRequestFailed` as `graphql` does.
 */
export const searchPullRequests = (
  source: GithubSource,
  since: string,
): Effect.Effect<
  {
    readonly pulls: ReadonlyArray<PullRequestRecord>;
    readonly truncated: boolean;
  },
  Failure,
  HttpClient.HttpClient
> =>
  Effect.reduce(
    ["created", "closed"],
    (): Found => ({ pulls: new Map(), truncated: false }),
    (found, field) =>
      found.truncated
        ? Effect.succeed(found)
        : collect(
            source,
            `repo:${source.repository} is:pr ${field}:>=${toSearchTime(since)} sort:updated-desc`,
            found,
            null,
          ),
  ).pipe(
    Effect.map(({ pulls, truncated }) => ({
      pulls: [...pulls.values()],
      truncated,
    })),
  );
