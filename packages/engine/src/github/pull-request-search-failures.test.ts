import { assert, describe, it } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";

import { search } from "../testing/github-search.js";
import { searchPage } from "../testing/stub-github.js";
import type { StubReply } from "../testing/stub-github.js";
import { GithubRateLimited, GithubRequestFailed } from "./github-errors.js";

type RateLimitCase = {
  readonly name: string;
  readonly reply: StubReply;
  readonly resetAt: string | null;
};

const RESET = { "x-ratelimit-reset": "1782900000" };

const rateLimits: ReadonlyArray<RateLimitCase> = [
  {
    name: "a 429 with a reset header",
    reply: { status: 429, headers: RESET },
    resetAt: "2026-07-01T09:20:00.000Z",
  },
  {
    name: "a 403 with an empty quota",
    reply: {
      status: 403,
      headers: { ...RESET, "x-ratelimit-remaining": "0" },
      body: { message: "API rate limit exceeded" },
    },
    resetAt: "2026-07-01T09:20:00.000Z",
  },
  // the test clock starts at the epoch
  {
    name: "a 403 with retry-after",
    reply: { status: 403, headers: { "retry-after": "60" } },
    resetAt: "1970-01-01T00:01:00.000Z",
  },
  {
    name: "a GraphQL RATE_LIMITED error",
    reply: {
      headers: RESET,
      body: {
        errors: [{ type: "RATE_LIMITED", message: "API rate limit exceeded" }],
      },
    },
    resetAt: "2026-07-01T09:20:00.000Z",
  },
  {
    name: "a limit without a reset time",
    reply: { status: 429 },
    resetAt: null,
  },
];

describe("searchPullRequests rate limits", () => {
  it.effect.each(rateLimits)(
    "fails with GithubRateLimited for $name",
    ({ reply, resetAt }) =>
      Effect.gen(function* () {
        const failure = yield* Effect.flip(search(() => reply).run);

        assert.deepStrictEqual(failure, new GithubRateLimited({ resetAt }));
      }),
  );
});

type FailureCase = {
  readonly name: string;
  readonly reply: StubReply;
  readonly expected: GithubRequestFailed;
};

const failures: ReadonlyArray<FailureCase> = [
  {
    name: "a rejected token",
    reply: { status: 401, body: { message: "Bad credentials" } },
    expected: new GithubRequestFailed({
      status: 401,
      message: "Bad credentials",
    }),
  },
  {
    name: "missing permissions",
    reply: {
      status: 403,
      body: { message: "Resource not accessible by personal access token" },
    },
    expected: new GithubRequestFailed({
      status: 403,
      message: "Resource not accessible by personal access token",
    }),
  },
  {
    name: "a body that is no JSON",
    reply: { status: 500 },
    expected: new GithubRequestFailed({ status: 500, message: "HTTP 500" }),
  },
  {
    name: "a GraphQL error",
    reply: {
      body: { errors: [{ type: "FORBIDDEN", message: "SAML enforcement" }] },
    },
    expected: new GithubRequestFailed({
      status: null,
      message: "SAML enforcement",
    }),
  },
  {
    name: "an unexpected shape",
    reply: { body: { data: { search: { nodes: "none" } } } },
    expected: new GithubRequestFailed({
      status: 200,
      message: "the response has an unexpected shape",
    }),
  },
];

describe("searchPullRequests failures", () => {
  it.effect.each(failures)(
    "fails with GithubRequestFailed for $name",
    ({ reply, expected }) =>
      Effect.gen(function* () {
        const failure = yield* Effect.flip(search(() => reply).run);

        assert.deepStrictEqual(failure, expected);
      }),
  );

  it.effect(
    "fails without a status for an unreachable host, and never mentions the token",
    () =>
      Effect.gen(function* () {
        const failure = yield* Effect.flip(search(() => "unreachable").run);

        assert.strictEqual(failure._tag, "GithubRequestFailed");
        assert.include(JSON.stringify(failure), "connection refused");
        assert.notInclude(JSON.stringify(failure), "s3cret-token");
      }),
  );
});

describe("searchPullRequests gateway failures", () => {
  it.effect("tries a 503 once more after a second", () =>
    Effect.gen(function* () {
      const recovering = search((index) =>
        index === 0 ? { status: 503 } : searchPage([]),
      );
      const fiber = yield* Effect.forkChild(recovering.run);
      yield* TestClock.adjust("1 second");
      yield* Fiber.join(fiber);

      // the 503, its retry, then the closed search
      assert.strictEqual(recovering.requests.length, 3);
    }),
  );

  it.effect("gives up after the second 502", () =>
    Effect.gen(function* () {
      const failing = search(() => ({
        status: 502,
        body: { message: "Bad Gateway" },
      }));
      const fiber = yield* Effect.forkChild(Effect.flip(failing.run));
      yield* TestClock.adjust("10 seconds");
      const failure = yield* Fiber.join(fiber);

      assert.deepStrictEqual(
        failure,
        new GithubRequestFailed({ status: 502, message: "Bad Gateway" }),
      );
      assert.strictEqual(failing.requests.length, 2);
    }),
  );
});
