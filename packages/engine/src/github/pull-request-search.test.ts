import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";

import { search } from "../testing/github-search.js";
import { searchPage } from "../testing/stub-github.js";

const node = (
  number: number,
  fields: Record<string, unknown> = {},
): Record<string, unknown> => ({
  number,
  createdAt: "2026-03-01T00:00:00Z",
  mergedAt: null,
  closedAt: null,
  author: { kind: "User", login: "ada" },
  reviews: { totalCount: 0, nodes: [] },
  ...fields,
});

const numbers = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, index) => node(from + index));

const SEARCH_URL = "https://api.github.com/graphql";
const SINCE = "2026-02-01T00:00:00Z";

describe("searchPullRequests requests", () => {
  it.effect(
    "searches created and closed pull requests since the date, authenticated",
    () =>
      Effect.gen(function* () {
        const { requests, run } = search(() => searchPage([]));

        yield* run;

        assert.deepStrictEqual(
          requests.map(({ url, authorization, variables }) => [
            url,
            authorization,
            variables,
          ]),
          ["created", "closed"].map((field) => [
            SEARCH_URL,
            "Bearer s3cret-token",
            {
              q: `repo:acme/web is:pr ${field}:>=${SINCE} sort:updated-desc`,
              cursor: null,
            },
          ]),
        );
      }),
  );

  it.effect(
    "follows the cursor through every page and merges the two searches by number",
    () =>
      Effect.gen(function* () {
        const replies = [
          searchPage(numbers(1, 3), "page-2"),
          searchPage(numbers(4, 5)),
          // the closed search repeats 5 and adds 6
          searchPage([node(5), node(6)]),
        ];
        const { requests, run } = search(
          (index) => replies[index] ?? searchPage([]),
        );

        const { pulls, truncated } = yield* run;

        assert.deepStrictEqual(
          pulls.map(({ number }) => number),
          [1, 2, 3, 4, 5, 6],
        );
        assert.isFalse(truncated);
        assert.deepStrictEqual(
          requests.map(({ variables }) => variables.cursor),
          [null, "page-2", null],
        );
      }),
  );
});

const merged = {
  mergedAt: "2026-03-02T00:00:00Z",
  closedAt: "2026-03-02T00:00:00Z",
  author: { kind: "Bot", login: "dependabot" },
};
const reviews = {
  totalCount: 4,
  nodes: [
    {
      state: "APPROVED",
      submittedAt: "2026-03-01T05:00:00Z",
      author: { kind: "User", login: "grace" },
    },
    {
      state: "PENDING",
      submittedAt: null,
      author: { kind: "User", login: "linus" },
    },
    { state: "COMMENTED", submittedAt: "2026-03-01T06:00:00Z", author: null },
    null,
  ],
};

describe("searchPullRequests records", () => {
  it.effect("reads authors, bots, deleted accounts and submitted reviews", () =>
    Effect.gen(function* () {
      const { run } = search((index) =>
        index > 0
          ? searchPage([])
          : searchPage([
              node(7, { ...merged, reviews }),
              null,
              node(8, { author: null }),
            ]),
      );

      const { pulls } = yield* run;

      assert.deepStrictEqual(
        pulls.map(({ number, author, reviews: given }) => [
          number,
          author,
          given.map((review) => [review.author, review.state]),
        ]),
        [
          [
            7,
            "dependabot[bot]",
            [
              ["grace", "APPROVED"],
              ["ghost", "COMMENTED"],
            ],
          ],
          [8, "ghost", []],
        ],
      );
      assert.strictEqual(pulls[0]?.mergedAt, "2026-03-02T00:00:00Z");
      assert.strictEqual(
        pulls[0]?.reviews[0]?.submittedAt,
        "2026-03-01T05:00:00Z",
      );
    }),
  );
});

describe("searchPullRequests cap", () => {
  it.effect("stops at 1,000 pull requests and marks the result truncated", () =>
    Effect.gen(function* () {
      const { requests, run } = search((index) =>
        searchPage(numbers(index * 100 + 1, index * 100 + 100), "more"),
      );

      const { pulls, truncated } = yield* run;

      assert.strictEqual(pulls.length, 1000);
      assert.isTrue(truncated);
      // ten pages of the first search; the second search is never started
      assert.strictEqual(requests.length, 10);
    }),
  );

  it.effect("is not truncated when the last page ends exactly at the cap", () =>
    Effect.gen(function* () {
      const { pulls, truncated } = yield* search((index) => {
        if (index >= 10) {
          return searchPage(numbers(1, 100));
        }
        return searchPage(
          numbers(index * 100 + 1, index * 100 + 100),
          index < 9 ? "more" : null,
        );
      }).run;

      assert.strictEqual(pulls.length, 1000);
      assert.isFalse(truncated);
    }),
  );
});

const pages = (from: number, count: number) =>
  Array.from({ length: count / 100 }, (_, page) =>
    numbers(from + page * 100, from + page * 100 + 99),
  );

const given = (state: string) => ({
  state,
  submittedAt: "2026-03-01T05:00:00Z",
  author: { kind: "User", login: "grace" },
});

describe("searchPullRequests truncation", () => {
  it.effect(
    "marks the result truncated when a search matched more than it returned",
    () =>
      Effect.gen(function* () {
        // GitHub matched 1,500 but returns at most 1,000: the last page ends the search early
        const { pulls, truncated } = yield* search(() =>
          searchPage(numbers(1, 3), null, 1500),
        ).run;

        assert.strictEqual(pulls.length, 3);
        assert.isTrue(truncated);
      }),
  );

  it.effect("checks the second search on its own", () =>
    Effect.gen(function* () {
      const { truncated } = yield* search((index) =>
        index === 0
          ? searchPage(numbers(1, 3))
          : searchPage(numbers(4, 5), null, 1200),
      ).run;

      assert.isTrue(truncated);
    }),
  );

  it.effect(
    "marks the merged result truncated when two complete searches together exceed the cap",
    () =>
      Effect.gen(function* () {
        // the created search returns 600 of 600, the closed one 500 other pull requests of 500: 1,100 in all
        const replies = [
          ...pages(1, 600).map((nodes, page, all) =>
            searchPage(nodes, page < all.length - 1 ? "more" : null, 600),
          ),
          ...pages(601, 500).map((nodes, page, all) =>
            searchPage(nodes, page < all.length - 1 ? "more" : null, 500),
          ),
        ];

        const { pulls, truncated } = yield* search(
          (index) => replies[index] ?? searchPage([]),
        ).run;

        assert.strictEqual(pulls.length, 1000);
        assert.isTrue(truncated);
      }),
  );
});

describe("searchPullRequests reviews", () => {
  it.effect(
    "reports reviewsTruncated when a pull request has more reviews than were fetched",
    () =>
      Effect.gen(function* () {
        const { run } = search((index) =>
          index === 0
            ? searchPage([
                node(1, {
                  reviews: { totalCount: 130, nodes: [given("APPROVED")] },
                }),
                node(2),
              ])
            : searchPage([]),
        );

        const result = yield* run;

        assert.isTrue(result.reviewsTruncated);
        assert.isFalse(result.truncated);
      }),
  );

  it.effect("is not reviewsTruncated when every review was fetched", () =>
    Effect.gen(function* () {
      const { reviewsTruncated } = yield* search((index) =>
        index === 0
          ? searchPage([
              node(1, {
                reviews: { totalCount: 1, nodes: [given("APPROVED")] },
              }),
            ])
          : searchPage([]),
      ).run;

      assert.isFalse(reviewsTruncated);
    }),
  );
});
