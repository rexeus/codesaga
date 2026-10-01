import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { Report } from "@codesaga/engine";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import { journey } from "../testing/journey-harness.js";
import { makeGithubProject, withFakeGh } from "../testing/projects.js";
import { searchResult } from "../testing/stub-github.js";
import type { GithubReply, GithubRequest } from "../testing/stub-github.js";

const decode = (stdout: string) =>
  Schema.decodeUnknownEffect(Report)(JSON.parse(stdout));

const daysAgo = (days: number, hours = 0): string =>
  new Date(Date.now() - days * 86_400_000 + hours * 3_600_000)
    .toISOString()
    .replace(/\.\d+Z$/u, "Z");

const user = (login: string) => ({ kind: "User", login });

// Ada's pull request is merged a day after it opened; Grace approved it two hours in. Grace's is still open.
const pullRequests = [
  {
    number: 1,
    createdAt: daysAgo(10),
    mergedAt: daysAgo(9),
    closedAt: daysAgo(9),
    author: user("ada"),
    reviews: {
      nodes: [
        {
          state: "APPROVED",
          submittedAt: daysAgo(10, 2),
          author: user("grace"),
        },
      ],
    },
  },
  {
    number: 2,
    createdAt: daysAgo(3),
    mergedAt: null,
    closedAt: null,
    author: user("grace"),
    reviews: {
      nodes: [
        {
          state: "COMMENTED",
          submittedAt: daysAgo(2),
          author: user("ada"),
        },
      ],
    },
  },
];

/** The created search finds both pull requests, the closed search only the merged one. */
const github = (request: GithubRequest): GithubReply =>
  request.search.includes(" closed:")
    ? searchResult(pullRequests.slice(0, 1))
    : searchResult(pullRequests);

// Real clock: the analysis window is resolved against now, and the commits are dated relative to it.
describe("codesaga analyze without --github", () => {
  it.live("makes no request without --github, even with a token at hand", () =>
    Effect.gen(function* () {
      const repo = yield* makeGithubProject;

      const result = yield* journey({
        args: ["analyze", "--json"],
        cwd: repo.root,
        env: { GH_TOKEN: "test-token" },
        github,
      });

      expect(result.exitCode).toBe(0);
      expect(result.githubRequests).toStrictEqual([]);
      expect(JSON.parse(result.stdout)).not.toHaveProperty("pullRequests");
    }).pipe(Effect.scoped),
  );

  it.live(
    "rejects a github key in .codesaga.json, so a cloned repository cannot switch on network use",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeGithubProject;
        writeFileSync(join(repo.root, ".codesaga.json"), '{ "github": true }');

        const result = yield* journey({
          args: ["analyze", "--json"],
          cwd: repo.root,
          env: { GH_TOKEN: "test-token" },
          github,
        });

        expect(result.exitCode).toBe(2);
        expect(result.stdout).toBe("");
        expect(result.stderr).toContain("github: unknown key");
        expect(result.githubRequests).toStrictEqual([]);
      }).pipe(Effect.scoped),
  );
});

describe("codesaga analyze --github report", () => {
  it.live(
    "adds the pull requests to the JSON report with the token from GH_TOKEN",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeGithubProject;

        const result = yield* journey({
          args: ["analyze", "--json", "--github"],
          cwd: repo.root,
          env: { GH_TOKEN: "test-token" },
          github,
        });

        expect(result.exitCode).toBe(0);
        expect(result.stderr).toBe("");
        const report = yield* decode(result.stdout);
        expect(report.pullRequests).toMatchObject({
          host: "github.com",
          repository: "acme/web",
          fetched: 2,
          truncated: false,
          opened: 2,
          merged: 1,
          closedUnmerged: 0,
          // 24 h to merge, first reviews after 2 h and 24 h
          medianHoursToMerge: 24,
          medianHoursToFirstReview: 13,
          authors: [
            { login: "ada", opened: 1, merged: 1 },
            { login: "grace", opened: 1, merged: 0 },
          ],
          reviewers: [
            { login: "grace", reviews: 1, approvals: 1 },
            { login: "ada", reviews: 1, approvals: 0 },
          ],
        });
        expect(
          result.githubRequests.map(({ url, authorization }) => [
            url,
            authorization,
          ]),
        ).toStrictEqual([
          ["https://api.github.com/graphql", "Bearer test-token"],
          ["https://api.github.com/graphql", "Bearer test-token"],
        ]);
      }).pipe(Effect.scoped),
  );
});

describe("codesaga analyze --github output and token", () => {
  it.live("limits the pull request authors and reviewers with --limit", () =>
    Effect.gen(function* () {
      const repo = yield* makeGithubProject;

      const result = yield* journey({
        args: ["analyze", "--json", "--github", "--limit", "1"],
        cwd: repo.root,
        env: { GH_TOKEN: "test-token" },
        github,
      });

      const { pullRequests: section } = yield* decode(result.stdout);
      expect(section?.authors).toHaveLength(1);
      expect(section?.reviewers).toHaveLength(1);
      expect(section?.totals).toStrictEqual({ authors: 2, reviewers: 2 });
    }).pipe(Effect.scoped),
  );

  it.live("prints a Pull requests block in the terminal view", () =>
    Effect.gen(function* () {
      const repo = yield* makeGithubProject;

      const result = yield* journey({
        args: ["analyze", "--github"],
        cwd: repo.root,
        env: { GH_TOKEN: "test-token" },
        github,
      });

      expect(result.stdout).toContain(
        "Pull requests              2 opened · 1 merged · 0 closed unmerged\n" +
          "                           median 24 h to merge · 13 h to first review",
      );
    }).pipe(Effect.scoped),
  );

  it.live("takes the token from gh auth token when no variable is set", () =>
    Effect.gen(function* () {
      const repo = yield* makeGithubProject;
      yield* withFakeGh("logged-in");

      const result = yield* journey({
        args: ["analyze", "--json", "--github"],
        cwd: repo.root,
        github,
      });

      expect(result.exitCode).toBe(0);
      expect(result.githubRequests[0]?.authorization).toBe(
        "Bearer gh-token-for-github.com",
      );
    }).pipe(Effect.scoped),
  );
});
