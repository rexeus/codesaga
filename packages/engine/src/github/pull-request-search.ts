// Owns searching a repository's pull requests through GitHub's GraphQL search.
// Two searches, pull requests created and pull requests closed since a date, are merged by number and capped.
// A search that matched more than it returned, or a pull request with more reviews than were fetched, is reported, never silently dropped.
import { Effect, Schema } from "effect";
import type { HttpClient } from "effect/http";

import type { PullRequestRecord } from "../pull-requests/pull-requests.js";
import type {
  GithubRateLimited,
  GithubRequestFailed,
  GithubTokenRejected,
} from "./github-errors.js";
import { graphql } from "./graphql.js";
import type { GithubSource } from "./source.js";

/** Pull requests fetched at most; GitHub's search returns no more than 1,000 per query anyway. */
const MAX_PULL_REQUESTS = 1000;
const PAGE_SIZE = 100;
const MAX_REVIEWS = 100;

const QUERY = `query($q: String!, $cursor: String) {
  search(query: $q, type: ISSUE, first: ${PAGE_SIZE}, after: $cursor) {
    issueCount
    pageInfo { hasNextPage endCursor }
    nodes {
      ... on PullRequest {
        number createdAt mergedAt closedAt
        author { kind: __typename login }
        reviews(first: ${MAX_REVIEWS}) {
          totalCount
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
    totalCount: Schema.Int,
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
    issueCount: Schema.Int,
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

/** What the searches found so far, by pull request number, and what they could not give. */
type Found = {
  readonly pulls: ReadonlyMap<number, PullRequestRecord>;
  /** More pull requests matched than were kept. */
  readonly truncated: boolean;
  /** Some kept pull request has more reviews than were fetched. */
  readonly reviewsTruncated: boolean;
};

/** Adds a page's pull requests until the cap; one more new pull request than fits marks the result truncated. */
const absorb = (found: Found, nodes: Page["nodes"]): Found => {
  const pulls = new Map(found.pulls);
  let { truncated, reviewsTruncated } = found;
  for (const node of nodes) {
    if (node === null || pulls.has(node.number)) {
      continue;
    }
    if (pulls.size >= MAX_PULL_REQUESTS) {
      truncated = true;
      break;
    }
    pulls.set(node.number, recordOf(node));
    reviewsTruncated ||= node.reviews.totalCount > node.reviews.nodes.length;
  }
  return { pulls, truncated, reviewsTruncated };
};

type Failure = GithubRateLimited | GithubRequestFailed | GithubTokenRejected;

/** Where a search stands: what all searches found, the next page's cursor, and how many results this search returned so far. */
type Progress = {
  readonly found: Found;
  readonly cursor: string | null;
  readonly seen: number;
};

/**
 * Pages through one search. The last page compares the results returned with
 * `issueCount`, how many GitHub matched.
 */
const collect = (
  source: GithubSource,
  search: string,
  { found, cursor, seen }: Progress,
): Effect.Effect<Found, Failure, HttpClient.HttpClient> =>
  graphql(
    { host: source.host, url: source.endpoint, token: source.token },
    QUERY,
    { q: search, cursor },
    SearchData,
  ).pipe(
    Effect.flatMap(({ search: page }) => {
      const next = absorb(found, page.nodes);
      const returned = seen + page.nodes.length;
      const { hasNextPage, endCursor } = page.pageInfo;
      if (!hasNextPage) {
        return Effect.succeed({
          ...next,
          truncated: next.truncated || page.issueCount > returned,
        });
      }
      if (next.truncated) {
        return Effect.succeed(next);
      }
      return next.pulls.size >= MAX_PULL_REQUESTS
        ? Effect.succeed({ ...next, truncated: true })
        : collect(source, search, {
            found: next,
            cursor: endCursor,
            seen: returned,
          });
    }),
  );

/** GitHub accepts a date-time to the second. */
const toSearchTime = (iso: string): string => iso.replace(/\.\d+Z$/u, "Z");

/**
 * Searches the repository's pull requests created, and those closed (merged or
 * not), since `since` (ISO 8601), merged by number, newest activity first,
 * 100 per request, each with its first 100 reviews. `truncated` says more
 * pull requests matched than are returned (the cap is 1,000, which is also
 * all GitHub's search returns); `reviewsTruncated` says some pull request has
 * more reviews than were fetched.
 *
 * Fails with `GithubRateLimited`, `GithubTokenRejected` and
 * `GithubRequestFailed` as `graphql` does.
 */
export const searchPullRequests = (
  source: GithubSource,
  since: string,
): Effect.Effect<
  {
    readonly pulls: ReadonlyArray<PullRequestRecord>;
    readonly truncated: boolean;
    readonly reviewsTruncated: boolean;
  },
  Failure,
  HttpClient.HttpClient
> =>
  Effect.reduce(
    ["created", "closed"],
    (): Found => ({
      pulls: new Map(),
      truncated: false,
      reviewsTruncated: false,
    }),
    (found, field) =>
      found.truncated
        ? Effect.succeed(found)
        : collect(
            source,
            `repo:${source.repository} is:pr ${field}:>=${toSearchTime(since)} sort:updated-desc`,
            { found, cursor: null, seen: 0 },
          ),
  ).pipe(
    Effect.map(({ pulls, truncated, reviewsTruncated }) => ({
      pulls: [...pulls.values()],
      truncated,
      reviewsTruncated,
    })),
  );
