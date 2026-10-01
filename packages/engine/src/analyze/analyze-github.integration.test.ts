import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { ConfigProvider, Effect, Schema } from "effect";
import { TestClock } from "effect/testing";

import {
  GithubTokenMissing,
  NotAGithubRemote,
} from "../github/github-errors.js";
import { Report } from "../report/report.js";
import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { installFakeGh } from "../testing/fake-gh.js";
import { searchPage, stubGithub } from "../testing/stub-github.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { analyzeWithGithub } from "./analyze-github.js";

// A 30 day window starts 2026-02-08T00:00Z.
const setNow = TestClock.setTime(Date.parse("2026-03-10T00:00:00Z"));
const env = (variables: Record<string, string>) =>
  Effect.provideService(
    ConfigProvider.ConfigProvider,
    ConfigProvider.fromEnvRecord(variables),
  );

const user = (login: string) => ({ kind: "User", login });
const pull = (fields: Record<string, unknown>) => ({
  mergedAt: null,
  closedAt: null,
  reviews: { nodes: [] },
  ...fields,
});

const created = [
  pull({
    number: 1,
    createdAt: "2026-02-10T00:00:00Z",
    mergedAt: "2026-02-10T12:00:00Z",
    closedAt: "2026-02-10T12:00:00Z",
    author: user("ada"),
    reviews: {
      nodes: [
        {
          state: "APPROVED",
          submittedAt: "2026-02-10T02:00:00Z",
          author: user("grace"),
        },
      ],
    },
  }),
  pull({
    number: 2,
    createdAt: "2026-03-02T00:00:00Z",
    author: user("grace"),
    reviews: {
      nodes: [
        {
          state: "COMMENTED",
          submittedAt: "2026-03-02T06:00:00Z",
          author: user("ada"),
        },
      ],
    },
  }),
];
// Opened before the window, merged 20 days later, inside it.
const closed = [
  pull({
    number: 3,
    createdAt: "2026-01-20T00:00:00Z",
    mergedAt: "2026-02-09T00:00:00Z",
    closedAt: "2026-02-09T00:00:00Z",
    author: user("linus"),
  }),
];

const commitHistory = (
  repo: Parameters<typeof analyzeOptionsFor>[0] & {
    commit: (
      date: string,
      files?: Record<string, string>,
    ) => Effect.Effect<void>;
  },
) =>
  repo
    .commit("2026-01-05T09:00:00Z", { "src/a.ts": "a\n" })
    .pipe(
      Effect.andThen(
        repo.commit("2026-02-20T09:00:00Z", { "src/a.ts": "a\nb\n" }),
      ),
    );

layer(NodeServices.layer)("analyzeWithGithub", (it) => {
  it.effect("adds the pull requests of the window to the report", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* repo.git("remote", "add", "origin", "git@github.com:acme/web.git");
      yield* installFakeGh("logged-out");
      yield* commitHistory(repo);
      const stub = stubGithub((_, index) =>
        searchPage([created, closed][index] ?? []),
      );

      const report = yield* analyzeWithGithub(
        analyzeOptionsFor(repo, { since: "30d" }),
      ).pipe(env({ GH_TOKEN: "token" }), Effect.provide(stub.layer));

      assert.deepStrictEqual(report.pullRequests, {
        host: "github.com",
        repository: "acme/web",
        fetched: 3,
        truncated: false,
        opened: 2,
        merged: 2,
        closedUnmerged: 0,
        // (12 h + 480 h) / 2
        medianHoursToMerge: 246,
        // 2 h and 6 h
        medianHoursToFirstReview: 4,
        months: [
          { month: "2026-02", opened: 1, merged: 2 },
          { month: "2026-03", opened: 1, merged: 0 },
        ],
        authors: [
          { login: "ada", opened: 1, merged: 1 },
          { login: "grace", opened: 1, merged: 0 },
          { login: "linus", opened: 0, merged: 1 },
        ],
        reviewers: [
          { login: "grace", reviews: 1, approvals: 1 },
          { login: "ada", reviews: 1, approvals: 0 },
        ],
        totals: { authors: 3, reviewers: 2 },
      });
      assert.deepStrictEqual(
        stub.requests.map(({ variables }) => variables.q),
        [
          "repo:acme/web is:pr created:>=2026-02-08T00:00:00Z sort:updated-desc",
          "repo:acme/web is:pr closed:>=2026-02-08T00:00:00Z sort:updated-desc",
        ],
      );
      yield* Schema.decodeUnknownEffect(Report)(
        JSON.parse(JSON.stringify(report)),
      );
    }),
  );
});

layer(NodeServices.layer)("analyzeWithGithub failures", (it) => {
  it.effect(
    "fails before reading history or calling GitHub without a token or a GitHub remote",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const noToken = yield* makeTempRepository;
        yield* noToken.git(
          "remote",
          "add",
          "origin",
          "https://github.com/acme/web",
        );
        const noRemote = yield* makeTempRepository;
        yield* installFakeGh("logged-out");
        const stub = stubGithub(() => searchPage([]));
        const run = (repo: typeof noToken) =>
          Effect.flip(analyzeWithGithub(analyzeOptionsFor(repo))).pipe(
            env({}),
            Effect.provide(stub.layer),
          );

        const missingToken = yield* run(noToken);
        const missingRemote = yield* run(noRemote);

        assert.deepStrictEqual(
          missingToken,
          new GithubTokenMissing({ host: "github.com" }),
        );
        assert.deepStrictEqual(
          missingRemote,
          new NotAGithubRemote({ remote: null }),
        );
        assert.strictEqual(stub.requests.length, 0);
      }),
  );
});
